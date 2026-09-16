from django.test import TestCase
from django.utils import timezone
from billing.models import Company, Customer, Invoice, InvoiceItem
from billing.utils import number_to_words_indian

class BillingSystemTests(TestCase):
    def setUp(self):
        # Setup company info
        from billing.config_helper import save_config_values
        save_config_values({
            'company_name': "Aastha Creation",
            'gst_number': "24AAAAA0000A1Z5",
            'pan_number': "ABCDE1234F",
            'plan_expiry_date': None
        })
        self.company = Company.objects.first()
        self.company.address = "Surat"
        self.company.phone = "9876543210"
        self.company.bank_name = "SBI"
        self.company.account_number = "3000"
        self.company.ifsc_code = "SBIN000"
        self.company.save()
        
        # Setup customer
        self.customer = Customer.objects.create(
            name="Surat Retailers",
            address="Ring Road, Surat",
            gst_number="24BBBBB0000B1Z5"
        )

    def test_amount_to_words(self):
        self.assertEqual(
            number_to_words_indian(62180.26),
            "Sixty Two Thousand One Hundred and Eighty Rupees and Twenty Six Paise Only"
        )
        self.assertEqual(
            number_to_words_indian(100500.00),
            "One Lakh Five Hundred Rupees Only"
        )

    def test_invoice_creation_and_totals(self):
        # Create test invoice
        invoice = Invoice.objects.create(
            bill_number="TEST/2026/01",
            customer=self.customer,
            bill_date=timezone.localdate(),
            gross_amount=62520.00,
            discount_percent=6.00,
            discount_amount=3751.20,
            blouse_charge=450.00,
            subtotal=59218.80,
            sgst_percent=2.50,
            sgst_amount=1480.47,
            cgst_percent=2.50,
            cgst_amount=1480.47,
            round_off=0.26,
            amount=62180.00,
            amount_in_words="Sixty-Two Thousand One Hundred and Eighty Rupees Only"
        )
        
        # Add invoice item
        item = InvoiceItem.objects.create(
            invoice=invoice,
            p_ch_no="543",
            lot_no="RATA",
            design="1088",
            meter=0.00,
            t_qty=120,
            p_qty=0,
            s_qty=0,
            qty=120,
            rate=521.00,
            amount=62520.00
        )
        
        # Verify invoice properties
        self.assertEqual(invoice.items.count(), 1)
        self.assertEqual(invoice.items.first().amount, 62520.00)
        self.assertEqual(invoice.amount, 62180.00)
        self.assertEqual(invoice.customer.name, "Surat Retailers")

    def test_invoice_preservation_on_customer_delete(self):
        # Create an invoice with a registered customer
        invoice = Invoice.objects.create(
            bill_number="TEST/2026/02",
            customer=self.customer,
            customer_name=self.customer.name,
            customer_address=self.customer.address,
            customer_gst_number=self.customer.gst_number,
            bill_date=timezone.localdate(),
            amount=100.00
        )
        
        # Verify customer relation exists
        self.assertEqual(invoice.customer, self.customer)
        self.assertEqual(invoice.display_customer_name, "Surat Retailers")
        
        # Delete customer
        self.customer.delete()
        
        # Fetch invoice from DB again
        invoice.refresh_from_db()
        
        # Customer relation must be null (SET_NULL)
        self.assertIsNone(invoice.customer)
        
        # Invoice metadata snapshots must remain intact
        self.assertEqual(invoice.customer_name, "Surat Retailers")
        self.assertEqual(invoice.display_customer_name, "Surat Retailers")
        self.assertEqual(invoice.display_customer_address, "Ring Road, Surat")
        self.assertEqual(invoice.display_customer_gst_number, "24BBBBB0000B1Z5")

    def test_invoice_with_ad_hoc_customer(self):
        # Create an invoice without a customer relation (ad-hoc customer)
        invoice = Invoice.objects.create(
            bill_number="TEST/2026/03",
            customer=None,
            customer_name="Ad-hoc Customer",
            customer_address="123 Street Name",
            customer_gst_number="24CCCCCC0000C1Z6",
            bill_date=timezone.localdate(),
            amount=250.00
        )
        
        # Verify customer is null but display fields fallback correctly
        self.assertIsNone(invoice.customer)
        self.assertEqual(invoice.customer_name, "Ad-hoc Customer")
        self.assertEqual(invoice.display_customer_name, "Ad-hoc Customer")
        self.assertEqual(invoice.display_customer_address, "123 Street Name")
        self.assertEqual(invoice.display_customer_gst_number, "24CCCCCC0000C1Z6")

    def test_invoice_history_ordering(self):
        import datetime
        # Create three invoices with different bill_dates
        inv_middle = Invoice.objects.create(
            bill_number="TEST/ORD/02",
            bill_date=datetime.date(2026, 6, 15),
            amount=100.00
        )
        inv_latest = Invoice.objects.create(
            bill_number="TEST/ORD/03",
            bill_date=datetime.date(2026, 6, 20),
            amount=200.00
        )
        inv_oldest = Invoice.objects.create(
            bill_number="TEST/ORD/01",
            bill_date=datetime.date(2026, 6, 10),
            amount=300.00
        )
        
        # Query through the view ordering logic
        ordered_invoices = Invoice.objects.all().order_by('-bill_date', '-created_at')
        
        # Verify order is inv_latest (June 20), inv_middle (June 15), inv_oldest (June 10)
        self.assertEqual(ordered_invoices[0].bill_number, "TEST/ORD/03")
        self.assertEqual(ordered_invoices[1].bill_number, "TEST/ORD/02")
        self.assertEqual(ordered_invoices[2].bill_number, "TEST/ORD/01")

    def test_invoice_pdf_view(self):
        from django.contrib.auth.models import User
        user = User.objects.create_user(username='admin', password='password')
        self.client.force_login(user)
        
        import datetime
        invoice = Invoice.objects.create(
            bill_number=None, # Null bill number test
            customer=self.customer,
            bill_date=datetime.date(2026, 6, 20),
            amount=100.00
        )
        
        # Request PDF endpoint
        response = self.client.get(f'/api/invoices/pdf/{invoice.id}/')
        
        # Verify response code is 200
        self.assertEqual(response.status_code, 200)
        
        # Verify content type is application/pdf
        self.assertEqual(response['Content-Type'], 'application/pdf')
        
        # Verify content disposition is inline
        self.assertIn('inline', response['Content-Disposition'])
        self.assertIn(f'filename="Invoice_{invoice.id}.pdf"', response['Content-Disposition'])

    def test_invoice_pdf_bulk_view(self):
        from django.contrib.auth.models import User
        user = User.objects.create_user(username='admin', password='password')
        self.client.force_login(user)
        
        import datetime
        inv1 = Invoice.objects.create(
            bill_number="BILL/1",
            customer=self.customer,
            bill_date=datetime.date(2026, 6, 20),
            amount=100.00
        )
        inv2 = Invoice.objects.create(
            bill_number="BILL/2",
            customer=self.customer,
            bill_date=datetime.date(2026, 6, 20),
            amount=200.00
        )
        
        # Request bulk PDF endpoint
        response = self.client.get(f'/api/invoices/pdf/bulk/?ids={inv1.id},{inv2.id}')
        
        # Verify response code is 200
        self.assertEqual(response.status_code, 200)
        
        # Verify content type is application/pdf
        self.assertEqual(response['Content-Type'], 'application/pdf')
        
        # Verify content disposition is attachment
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn('filename="Invoices_Bulk.pdf"', response['Content-Disposition'])

    def test_invoice_pdf_bulk_ordering(self):
        from django.contrib.auth.models import User
        from unittest.mock import patch
        
        user = User.objects.create_user(username='admin_ord', password='password')
        self.client.force_login(user)
        
        import datetime
        inv1 = Invoice.objects.create(
            bill_number="BILL/O1", customer=self.customer, bill_date=datetime.date(2026, 6, 20), amount=100.00
        )
        inv2 = Invoice.objects.create(
            bill_number="BILL/O2", customer=self.customer, bill_date=datetime.date(2026, 6, 20), amount=200.00
        )
        
        with patch('billing.views.generate_bulk_invoice_pdf') as mock_gen:
            mock_gen.return_value = b'PDF DATA'
            
            # Request in order [inv2, inv1]
            response = self.client.get(f'/api/invoices/pdf/bulk/?ids={inv2.id},{inv1.id}')
            self.assertEqual(response.status_code, 200)
            
            # Assert mock was called with list in order [inv2, inv1]
            called_args = mock_gen.call_args[0]
            passed_invoices = list(called_args[0])
            self.assertEqual(len(passed_invoices), 2)
            self.assertEqual(passed_invoices[0].id, inv2.id)
            self.assertEqual(passed_invoices[1].id, inv1.id)

    def test_plaintext_authentication(self):
        from django.contrib.auth.models import User
        from django.contrib.auth import authenticate
        
        username = 'test_plain_user'
        password = 'securepassword123'
        user = User.objects.create_user(username=username, password=password)
        
        db_user = User.objects.get(username=username)
        self.assertEqual(db_user.password, password)
        
        authenticated_user = authenticate(username=username, password=password)
        self.assertIsNotNone(authenticated_user)
        self.assertEqual(authenticated_user.username, username)
        
        bad_user = authenticate(username=username, password='wrongpassword')
        self.assertIsNone(bad_user)

    def test_plan_expiry_validation_form(self):
        import datetime
        from django.core.exceptions import ValidationError
        from billing.forms import InvoiceForm

        self.company.plan_expiry_date = datetime.date(2026, 6, 25)
        self.company.save()

        # Test valid bill_date before plan expiry date
        form_data_valid = {
            'bill_number': 'TEST/EXP/01',
            'customer': self.customer.id,
            'bill_date': '2026-06-24',
            'gross_amount': 0.00,
            'discount_percent': 0.00,
            'discount_amount': 0.00,
            'blouse_charge': 0.00,
            'subtotal': 0.00,
            'sgst_percent': 2.50,
            'sgst_amount': 0.00,
            'cgst_percent': 2.50,
            'cgst_amount': 0.00,
            'round_off': 0.00,
            'amount': 0.00,
        }
        form = InvoiceForm(data=form_data_valid)
        self.assertTrue(form.is_valid())

        # Test valid bill_date exactly on plan expiry date
        form_data_exact = form_data_valid.copy()
        form_data_exact['bill_date'] = '2026-06-25'
        form = InvoiceForm(data=form_data_exact)
        self.assertTrue(form.is_valid())

        # Test bill_date is allowed without expiry restriction
        form_data_future = form_data_valid.copy()
        form_data_future['bill_date'] = '2026-06-26'
        form = InvoiceForm(data=form_data_future)
        self.assertTrue(form.is_valid())

    def test_plan_expiry_validation_api(self):
        from django.contrib.auth.models import User
        import datetime
        import json

        user = User.objects.create_user(username='admin_api', password='password')
        self.client.force_login(user)

        self.company.plan_expiry_date = datetime.date(2026, 6, 25)
        self.company.save()

        # Post an invoice date
        payload = {
            'bill_number': 'TEST/API/EXP',
            'customer': self.customer.id,
            'bill_date': '2026-06-26',
            'gross_amount': 100.00,
            'discount_percent': 0.00,
            'discount_amount': 0.00,
            'blouse_charge': 0.00,
            'subtotal': 100.00,
            'sgst_percent': 2.50,
            'sgst_amount': 2.50,
            'cgst_percent': 2.50,
            'cgst_amount': 2.50,
            'round_off': 0.00,
            'amount': 105.00,
            'items': [
                {
                    'design': '123',
                    'qty': 1,
                    'rate': 100.00,
                    'amount': 100.00
                }
            ]
        }

        response = self.client.post(
            '/api/invoices/add/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertIn(response.status_code, [200, 201])

    def test_company_settings_editable(self):
        from django.contrib.auth.models import User
        import json

        user = User.objects.create_user(username='admin_settings', password='password')
        self.client.force_login(user)

        payload = {
            'company_name': 'Updated Textiles Pvt Ltd',
            'phone': '9876543210',
            'address': 'Surat, Gujarat',
            'gst_number': '24ABCDE1234F1Z5',
            'state_code': '24-GJ',
            'pan_number': 'ABCDE1234F',
            'bank_name': 'HDFC Bank',
            'account_number': '1234567890',
            'ifsc_code': 'HDFC0001234',
            'terms_conditions': 'Standard terms'
        }

        response = self.client.post(
            '/api/settings/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.company.refresh_from_db()
        self.assertEqual(self.company.company_name, 'Updated Textiles Pvt Ltd')
        self.assertEqual(self.company.gst_number, '24ABCDE1234F1Z5')

    def test_unconfigured_values_return_blank(self):
        from billing.config_helper import save_config_values, get_config_value
        save_config_values({
            'company_name': None,
            'gst_number': None,
            'pan_number': None,
            'plan_expiry_date': None
        })
        self.assertEqual(get_config_value('company_name'), '')
        self.assertEqual(get_config_value('gst_number'), '')
        self.assertEqual(get_config_value('pan_number'), '')
        self.assertEqual(get_config_value('plan_expiry_date'), '')

    def test_login_api_json_success(self):
        from django.contrib.auth.models import User
        username = 'login_user_json'
        password = 'secure_password_123'
        User.objects.create_user(username=username, password=password)
        
        response = self.client.post(
            '/api/login/',
            data='{"username": "login_user_json", "password": "secure_password_123"}',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertTrue(resp_json.get('success'))
        self.assertEqual(resp_json.get('username'), username)

    def test_login_api_urlencoded_success(self):
        from django.contrib.auth.models import User
        from urllib.parse import urlencode
        username = 'login_user_urlenc'
        password = 'secure_password_456'
        User.objects.create_user(username=username, password=password)
        
        response = self.client.post(
            '/api/login/',
            data=urlencode({'username': username, 'password': password}),
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertTrue(resp_json.get('success'))
        self.assertEqual(resp_json.get('username'), username)

    def test_login_api_empty_body(self):
        response = self.client.post(
            '/api/login/',
            data='',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('error'), 'Request body is empty.')

    def test_login_api_invalid_json(self):
        response = self.client.post(
            '/api/login/',
            data='{"username": "someuser", "password": ',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('error'), 'Invalid JSON format.')

    def test_login_api_admin_reserved(self):
        response = self.client.post(
            '/api/login/',
            data='{"username": "admin", "password": "somepassword"}',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('error'), 'User not found.')

    def test_register_api_success(self):
        import json
        payload = {
            'username': 'new_business_owner',
            'password': 'password123',
            'company_name': 'My New Embroidery Hub',
            'gst_number': '24AABCB1234F1Z1',
            'phone': '9876543210',
            'address': 'Ring Road, Surat'
        }
        response = self.client.post(
            '/api/register/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json().get('success'))
        self.assertEqual(response.json().get('username'), 'new_business_owner')

        # Verify company and user were updated/created
        from django.contrib.auth.models import User
        self.assertTrue(User.objects.filter(username='new_business_owner').exists())
        self.company.refresh_from_db()
        self.assertEqual(self.company.company_name, 'My New Embroidery Hub')
        self.assertEqual(self.company.gst_number, '24AABCB1234F1Z1')

    def test_register_api_duplicate_username(self):
        import json
        from django.contrib.auth.models import User
        User.objects.create_user(username='existing_user', password='password123')

        payload = {
            'username': 'existing_user',
            'password': 'password123',
            'company_name': 'Another Company'
        }
        response = self.client.post(
            '/api/register/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('already taken', response.json().get('error', '').lower())

    def test_register_api_validation(self):
        import json
        # Missing username
        response = self.client.post(
            '/api/register/',
            data=json.dumps({'username': '', 'password': '123'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Username is required', response.json().get('error'))

        # Short password
        response = self.client.post(
            '/api/register/',
            data=json.dumps({'username': 'validuser', 'password': '12'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('at least 4 characters', response.json().get('error'))


class AutoIncrementBillNumberTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            address="Surat",
            phone="9876543210"
        )
        self.customer = Customer.objects.create(
            name="Test Customer"
        )

    def test_increment_bill_number_helper(self):
        from billing.views import increment_bill_number
        self.assertEqual(increment_bill_number("100"), "101")
        self.assertEqual(increment_bill_number("INV-001"), "INV-002")
        self.assertEqual(increment_bill_number("EB/24-25/045"), "EB/24-25/046")
        self.assertEqual(increment_bill_number("NO_DIGITS"), "NO_DIGITS1")
        self.assertEqual(increment_bill_number(None), "1")
        self.assertEqual(increment_bill_number(""), "1")

    def test_get_next_bill_number_empty_db(self):
        from billing.views import get_next_bill_number
        # No setting configured
        self.assertEqual(get_next_bill_number(), "1")
        
        # Configure starting bill no to prefix "INV-" and start number 500
        self.company.bill_no_prefix = "INV-"
        self.company.bill_no_start_number = 500
        self.company.save()
        self.assertEqual(get_next_bill_number(), "INV-500")

    def test_get_next_bill_number_with_invoices(self):
        from billing.views import get_next_bill_number
        self.company.bill_no_prefix = "INV-"
        self.company.bill_no_start_number = 100
        self.company.save()
        
        # Create an invoice
        import datetime
        Invoice.objects.create(
            bill_number="INV-100",
            customer=self.customer,
            bill_date=datetime.date.today(),
            is_challan=False
        )
        
        # Next should be INV-101
        self.assertEqual(get_next_bill_number(), "INV-101")
        
        # Create next invoice
        Invoice.objects.create(
            bill_number="INV-101",
            customer=self.customer,
            bill_date=datetime.date.today(),
            is_challan=False
        )
        
        # Next should be INV-102
        self.assertEqual(get_next_bill_number(), "INV-102")

        # Change settings start_bill_no to prefix "INV-" and start number 200
        self.company.bill_no_prefix = "INV-"
        self.company.bill_no_start_number = 200
        self.company.save()
        
        # Next should jump to INV-200
        self.assertEqual(get_next_bill_number(), "INV-200")
        
        # Create invoice with INV-200
        Invoice.objects.create(
            bill_number="INV-200",
            customer=self.customer,
            bill_date=datetime.date.today(),
            is_challan=False
        )
        
        # Next should be INV-201
        self.assertEqual(get_next_bill_number(), "INV-201")

    def test_verify_password(self):
        from django.contrib.auth.models import User
        # Create a test user
        test_user = User.objects.create_user(username="testuser", password="secure_password_123")
        
        # Log in test user
        self.client.login(username="testuser", password="secure_password_123")
        
        # Test success case
        response = self.client.post(
            '/api/verify-password/',
            data={'password': 'secure_password_123'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': True})
        
        # Test failure case (incorrect password)
        response = self.client.post(
            '/api/verify-password/',
            data={'password': 'wrong_password'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': 'Incorrect password.'})
        
        # Test failure case (missing password)
        response = self.client.post(
            '/api/verify-password/',
            data={},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)



