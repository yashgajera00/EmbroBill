import json
import re
from decimal import Decimal, InvalidOperation
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.clickjacking import xframe_options_exempt

from .models import Company, Customer, Invoice, InvoiceItem, DashboardItem
from .forms import CompanyForm, CustomerForm, InvoiceForm
from .utils import generate_invoice_pdf, generate_bulk_invoice_pdf, generate_challan_pdf, generate_bulk_challan_pdf, number_to_words_indian

# Helper to safely clean and convert values to Decimal
def clean_decimal_value(val, field_name, required=False):
    original_val = val
    if val is None:
        if required:
            raise ValidationError({field_name: f"Field '{field_name}' is required."})
        return Decimal('0.00')
        
    if isinstance(val, (int, float)):
        return Decimal(f"{val:.2f}" if isinstance(val, float) else str(val))
        
    if isinstance(val, str):
        val_stripped = val.strip()
        if val_stripped == "" or val_stripped == ".":
            if required:
                raise ValidationError({field_name: f"Field '{field_name}' cannot be empty."})
            return Decimal('0.00')
            
        # Remove commas
        val_clean = val_stripped.replace(',', '')
        
        try:
            return Decimal(val_clean)
        except InvalidOperation:
            import logging
            logger = logging.getLogger(__name__)
            logger.error("Decimal conversion failed for field '%s' with value: %r", field_name, original_val)
            print(f"Decimal conversion failed for field '{field_name}' with value: {original_val!r}")
            raise ValidationError({field_name: f"Invalid numeric value '{original_val}' for field '{field_name}'."})
            
    # Fallback
    try:
        return Decimal(val)
    except InvalidOperation:
        import logging
        logger = logging.getLogger(__name__)
        logger.error("Decimal conversion failed for field '%s' with value: %r", field_name, original_val)
        print(f"Decimal conversion failed for field '{field_name}' with value: {original_val!r}")
        raise ValidationError({field_name: f"Invalid numeric value '{original_val}' for field '{field_name}'."})

# ─── Per-Product Status Helpers ─────────────────────────────────────────

def _mark_dashboard_products_done(billed_products, invoice_id):
    """Mark specific products inside DashboardItem.products_json as 'Done' and link to invoice_id."""
    if not billed_products:
        return
    # Group by item_id
    items_map = {}
    for bp in billed_products:
        item_id = bp.get('item_id')
        product_index = bp.get('product_index')
        if item_id is not None and product_index is not None:
            items_map.setdefault(item_id, []).append(product_index)
    
    for item_id, indices in items_map.items():
        try:
            db_item = DashboardItem.objects.get(id=item_id)
        except DashboardItem.DoesNotExist:
            continue
        products = []
        try:
            products = json.loads(db_item.products_json) if db_item.products_json else []
        except Exception:
            pass
        if not products:
            products = [{
                'design': db_item.design or '',
                'lot_no': db_item.lot_no or '',
                'meter': float(db_item.meter or 0),
                'qty': float(db_item.qty or 0),
                'rate': float(db_item.rate or 0),
                'hsn_code': db_item.hsn_code or '',
                'status': db_item.status or 'Pending'
            }]
        for idx in indices:
            if 0 <= idx < len(products):
                products[idx]['status'] = 'Done'
                products[idx]['invoice_id'] = invoice_id
        # Recalculate overall status
        all_done = all(p.get('status') == 'Done' for p in products)
        db_item.status = 'Done' if all_done else 'Pending'
        db_item.products_json = json.dumps(products)
        db_item.save()


def _revert_dashboard_products_for_invoice(invoice_id):
    """Revert all dashboard products linked to a given invoice_id back to 'Pending'."""
    if not invoice_id:
        return
    # Search all dashboard items for products linked to this invoice
    for db_item in DashboardItem.objects.all():
        products = []
        try:
            products = json.loads(db_item.products_json) if db_item.products_json else []
        except Exception:
            continue
        if not products:
            continue
        changed = False
        for p in products:
            if p.get('invoice_id') == invoice_id:
                p['status'] = 'Pending'
                p.pop('invoice_id', None)
                changed = True
        if changed:
            all_done = all(p.get('status') == 'Done' for p in products)
            db_item.status = 'Done' if all_done else 'Pending'
            db_item.products_json = json.dumps(products)
            db_item.save()


# Decorator to enforce JSON API authentication status
def api_login_required(view_func):
    def _wrapped_view_func(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required.'}, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped_view_func

def increment_bill_number(bill_no):
    if not bill_no:
        return "1"
    # Find trailing digits
    match = re.search(r'(.*?)(\d+)$', bill_no)
    if match:
        prefix, digits = match.groups()
        length = len(digits)
        next_num = int(digits) + 1
        return f"{prefix}{str(next_num).zfill(length)}"
    else:
        # If no trailing digits, append "1"
        return f"{bill_no}1"

def get_next_bill_number():
    company = Company.objects.first()
    prefix = getattr(company, 'bill_no_prefix', '') or ''
    prefix = prefix.strip()
    
    try:
        start_num = int(getattr(company, 'bill_no_start_number', 1) or 1)
    except (ValueError, TypeError):
        start_num = 1
        
    start_bill_no = f"{prefix}{start_num}"
    
    # Check if there are any invoices starting with this prefix
    invoices_with_prefix = Invoice.objects.filter(is_challan=False, bill_number__startswith=prefix)
    
    if not invoices_with_prefix.exists():
        return start_bill_no
        
    # Check if the start_bill_no itself has been used yet
    if not invoices_with_prefix.filter(bill_number=start_bill_no).exists():
        return start_bill_no
        
    # Get the latest invoice that starts with this prefix
    latest_invoice = invoices_with_prefix.exclude(bill_number=None).exclude(bill_number='').order_by('-id').first()
    if latest_invoice:
        bill_no = latest_invoice.bill_number
        if prefix and bill_no.startswith(prefix):
            suffix = bill_no[len(prefix):]
            return f"{prefix}{increment_bill_number(suffix)}"
        return increment_bill_number(bill_no)
        
    return start_bill_no

@api_login_required
def next_bill_number_view(request):
    next_bill = get_next_bill_number()
    return JsonResponse({'next_bill_number': next_bill})

# Serialization Helpers
def serialize_customer(customer):
    return {
        'id': customer.id,
        'name': customer.name,
        'address': customer.address,
        'gst_number': customer.gst_number
    }

def serialize_company(company):
    return {
        'id': company.id,
        'company_name': company.company_name,
        'address': company.address,
        'phone': company.phone,
        'gst_number': company.gst_number,
        'state_code': company.state_code,
        'pan_number': company.pan_number,
        'bank_name': company.bank_name,
        'account_number': company.account_number,
        'ifsc_code': company.ifsc_code,
        'terms_conditions': company.terms_conditions,
        'plan_expiry_date': company.plan_expiry_date.isoformat() if company.plan_expiry_date else '',
        'user_id': company.user_id,
        'bill_no_prefix': company.bill_no_prefix or '',
        'bill_no_start_number': company.bill_no_start_number or 1,
        'default_hsn_code': company.default_hsn_code or ''
    }

def serialize_invoice(invoice):
    return {
        'id': invoice.id,
        'bill_number': invoice.bill_number or '',
        'customer': {
            'id': invoice.customer.id if invoice.customer else None,
            'name': invoice.display_customer_name,
            'address': invoice.display_customer_address,
            'gst_number': invoice.display_customer_gst_number
        },
        'challan_no': invoice.challan_no,
        'broker': invoice.broker,
        'hsn_code': invoice.hsn_code,
        'bill_date': invoice.bill_date.isoformat() if invoice.bill_date else '',
        'gross_amount': float(invoice.gross_amount),
        'discount_percent': float(invoice.discount_percent),
        'discount_amount': float(invoice.discount_amount),
        'blouse_charge': float(invoice.blouse_charge),
        'extra_charges': float(invoice.extra_charges),
        'extra_charges_type': invoice.extra_charges_type or 'add',
        'extra_charges_reason': invoice.extra_charges_reason or '',
        'subtotal': float(invoice.subtotal),
        'sgst_percent': float(invoice.sgst_percent),
        'sgst_amount': float(invoice.sgst_amount),
        'cgst_percent': float(invoice.cgst_percent),
        'cgst_amount': float(invoice.cgst_amount),
        'round_off': float(invoice.round_off),
        'amount': float(invoice.amount),
        'amount_in_words': invoice.amount_in_words,
        'is_challan': invoice.is_challan,
        'note_type': invoice.note_type or '',
        'note_amount': float(invoice.note_amount or 0),
        'bank_name': invoice.bank_name or '',
        'check_no': invoice.check_no or '',
        'check_date': invoice.check_date.isoformat() if invoice.check_date else '',
        'tds': float(invoice.tds or 0),
        'dashboard_item_id': invoice.dashboard_item_id,
        'dashboard_item_date': invoice.dashboard_item.date.isoformat() if (invoice.dashboard_item and invoice.dashboard_item.date) else '',
        'created_at': invoice.created_at.isoformat() if invoice.created_at else ''
    }

def serialize_invoice_item(item):
    return {
        'id': item.id,
        'p_ch_no': item.p_ch_no,
        'lot_no': item.lot_no,
        'design': item.design,
        'meter': float(item.meter),
        't_qty': float(item.t_qty),
        'p_qty': float(item.p_qty),
        's_qty': float(item.s_qty),
        'qty': float(item.qty),
        'rate': float(item.rate),
        'amount': float(item.amount)
    }

# View Actions
@ensure_csrf_cookie
def auth_status(request):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    users_exist = User.objects.exists()
    
    if request.user.is_authenticated:
        return JsonResponse({
            'isAuthenticated': True,
            'username': request.user.username,
            'users_exist': users_exist
        })
    return JsonResponse({
        'isAuthenticated': False,
        'users_exist': users_exist
    })

@ensure_csrf_cookie
def login_view(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'success': True,
            'username': request.user.username
        })
    
    if request.method == 'POST':
        # Log raw request body and Content-Type header before parsing
        import logging
        logger = logging.getLogger(__name__)
        
        content_type = request.META.get('CONTENT_TYPE', '')
        logger.info("Login view - Content-Type: %s", content_type)
        logger.info("Login view - Raw request body: %r", request.body)
        print(f"Login view - Content-Type: {content_type}")
        print(f"Login view - Raw request body: {request.body!r}")

        # Check if request body is empty
        if not request.body or not request.body.strip():
            return JsonResponse({'error': 'Request body is empty.'}, status=400)

        username = None
        password = None

        if 'application/x-www-form-urlencoded' in content_type:
            username = request.POST.get('username')
            password = request.POST.get('password')
        else:
            try:
                data = json.loads(request.body)
                if not isinstance(data, dict):
                    return JsonResponse({'error': 'Invalid JSON format. Expected an object.'}, status=400)
                username = data.get('username')
                password = data.get('password')
            except json.JSONDecodeError as e:
                logger.error("JSONDecodeError in login view: %s", str(e))
                return JsonResponse({'error': 'Invalid JSON format.'}, status=400)
            except Exception as e:
                logger.error("Error parsing login request body: %s", str(e))
                return JsonResponse({'error': 'Invalid request body.'}, status=400)

        if not username or not password:
            return JsonResponse({'error': 'Username and password are required.'}, status=400)

        try:
            if username and username.lower() == 'admin':
                return JsonResponse({'error': 'User not found.'}, status=400)
                
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return JsonResponse({
                    'success': True,
                    'username': user.username
                })
            else:
                return JsonResponse({'error': 'Invalid username or password.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
            
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

def logout_view(request):
    logout(request)
    return JsonResponse({'success': True})

@api_login_required
def change_password(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            old_password = data.get('old_password')
            new_password = data.get('new_password')
            
            user = request.user
            if not user.check_password(old_password):
                return JsonResponse({'error': 'Incorrect old password.'}, status=400)
            if not new_password:
                return JsonResponse({'error': 'New password cannot be empty.'}, status=400)
            
            from django.utils import timezone
            user.set_password(new_password)
            if user.date_joined is None:
                user.date_joined = timezone.now()
            user.save()
            
            # Keep the user logged in after password change
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, user)
            
            return JsonResponse({'success': True, 'message': 'Password changed successfully.'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def verify_password(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            password = data.get('password')
            if not password:
                return JsonResponse({'error': 'Password is required.'}, status=400)
            
            user = request.user
            if user.check_password(password):
                return JsonResponse({'success': True})
            else:
                return JsonResponse({'error': 'Incorrect password.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def company_settings(request):
    company = Company.objects.first()
    
    if request.method == 'GET':
        if company:
            return JsonResponse(serialize_company(company))
        return JsonResponse({}, status=200)
        
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            if company:
                # Enforce read-only constraint for Company Name, GST, PAN, and Expiry Date
                new_name = data.get('company_name')
                new_gst = data.get('gst_number')
                new_pan = data.get('pan_number')
                
                if new_name is not None and new_name.strip() != company.company_name.strip():
                    return JsonResponse({'error': 'Company Name is read-only and cannot be changed.'}, status=403)
                if new_gst is not None and new_gst.strip().upper() != company.gst_number.strip().upper():
                    return JsonResponse({'error': 'GST Number is read-only and cannot be changed.'}, status=403)
                if new_pan is not None and new_pan.strip().upper() != company.pan_number.strip().upper():
                    return JsonResponse({'error': 'PAN Number is read-only and cannot be changed.'}, status=403)
                
                new_expiry = data.get('plan_expiry_date')
                if new_expiry is not None:
                    curr_expiry = company.plan_expiry_date.isoformat() if company.plan_expiry_date else ''
                    if new_expiry != curr_expiry:
                        return JsonResponse({'error': 'Plan Expiry Date is read-only and cannot be changed.'}, status=403)
            
                form = CompanyForm(data, instance=company)
            else:
                form = CompanyForm(data)
                
            if form.is_valid():
                saved_company = form.save()
                return JsonResponse(serialize_company(saved_company))
            else:
                return JsonResponse({'error': 'Invalid form data.', 'details': form.errors}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
            
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

def activate_license(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed.'}, status=405)
    
    try:
        data = json.loads(request.body)
        token = data.get('token', '').strip()
    except Exception:
        return JsonResponse({'error': 'Invalid request body.'}, status=400)
        
    if not token:
        return JsonResponse({'error': 'License Key is required.'}, status=400)
        
    # Send request to the external license server using built-in urllib
    import urllib.request
    import urllib.error
    import ssl
    try:
        import certifi
        cafile = certifi.where()
    except ImportError:
        cafile = None

    if cafile:
        ssl_context = ssl.create_default_context(cafile=cafile)
    else:
        ssl_context = ssl.create_default_context()
    
    url = "https://yashgajera00.pythonanywhere.com/api/license/"
    post_data = json.dumps({"token": token}).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=post_data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as response:
            resp_bytes = response.read()
            status_code = response.status
    except urllib.error.HTTPError as e:
        import logging
        import traceback
        import sys
        import ssl
        import socket
        logger = logging.getLogger(__name__)
        tb_str = traceback.format_exc()
        
        requests_err = "N/A (urllib is used instead of requests)"
        ssl_err = "No"
        timeout_err = "No"
        
        log_msg = (
            f"License Activation API Request Failed.\n"
            f"- Remote URL being called: {url}\n"
            f"- Exception Type: {type(e).__module__}.{type(e).__name__}\n"
            f"- Exception Message: {str(e)}\n"
            f"- HTTP Status Code: {e.code}\n"
            f"- Reason: {e.reason}\n"
            f"- Requests library error (if any): {requests_err}\n"
            f"- SSL error (if any): {ssl_err}\n"
            f"- Timeout (if any): {timeout_err}\n"
            f"- Full Traceback:\n{tb_str}"
        )
        logger.error(log_msg)
        sys.stderr.write(log_msg + "\n")
        sys.stderr.flush()
        
        status_code = e.code
        resp_bytes = e.read()
    except Exception as e:
        import logging
        import traceback
        import sys
        import ssl
        import socket
        logger = logging.getLogger(__name__)
        tb_str = traceback.format_exc()
        
        requests_err = "N/A (urllib is used instead of requests)"
        if 'requests' in type(e).__module__:
            requests_err = f"{type(e).__name__}: {str(e)}"
            
        ssl_err = "No"
        if isinstance(e, ssl.SSLError):
            ssl_err = f"Yes: {type(e).__module__}.{type(e).__name__}: {str(e)}"
        elif hasattr(e, 'reason') and isinstance(e.reason, ssl.SSLError):
            ssl_err = f"Yes: {type(e.reason).__module__}.{type(e.reason).__name__}: {str(e.reason)}"
        elif "ssl" in str(e).lower() or "cert" in str(e).lower():
            ssl_err = f"Yes (detected in string): {str(e)}"
            
        timeout_err = "No"
        if isinstance(e, socket.timeout) or isinstance(e, TimeoutError):
            timeout_err = f"Yes: {type(e).__module__}.{type(e).__name__}: {str(e)}"
        elif hasattr(e, 'reason') and (isinstance(e.reason, socket.timeout) or "timeout" in str(e.reason).lower()):
            timeout_err = f"Yes: {str(e.reason)}"
        elif "timeout" in str(e).lower():
            timeout_err = f"Yes (detected in string): {str(e)}"
            
        log_msg = (
            f"License Activation API Request Failed.\n"
            f"- Remote URL being called: {url}\n"
            f"- Exception Type: {type(e).__module__}.{type(e).__name__}\n"
            f"- Exception Message: {str(e)}\n"
            f"- Requests library error (if any): {requests_err}\n"
            f"- SSL error (if any): {ssl_err}\n"
            f"- Timeout (if any): {timeout_err}\n"
            f"- Full Traceback:\n{tb_str}"
        )
        logger.error(log_msg)
        sys.stderr.write(log_msg + "\n")
        sys.stderr.flush()
        
        return JsonResponse({
            'error': 'Unable to connect to the License Server. Please check your internet connection.'
        }, status=503)
        
    try:
        res_data = json.loads(resp_bytes.decode('utf-8'))
    except Exception as e:
        import logging
        import traceback
        import sys
        import ssl
        import socket
        logger = logging.getLogger(__name__)
        tb_str = traceback.format_exc()
        
        requests_err = "N/A (urllib is used instead of requests)"
        ssl_err = "No"
        timeout_err = "No"
        
        log_msg = (
            f"License Activation Response Parsing Failed.\n"
            f"- Remote URL being called: {url}\n"
            f"- Exception Type: {type(e).__module__}.{type(e).__name__}\n"
            f"- Exception Message: {str(e)}\n"
            f"- Requests library error (if any): {requests_err}\n"
            f"- SSL error (if any): {ssl_err}\n"
            f"- Timeout (if any): {timeout_err}\n"
            f"- Full Traceback:\n{tb_str}"
        )
        logger.error(log_msg)
        sys.stderr.write(log_msg + "\n")
        sys.stderr.flush()
        
        return JsonResponse({'error': 'Invalid response from license server.'}, status=502)
        
    # Check if the response indicates success
    if res_data.get('success') and res_data.get('active'):
        company_name = res_data.get('company_name', '').strip()
        gst_number = res_data.get('gst_number', '').strip()
        pan_number = res_data.get('pan_number', '').strip()
        plan_expiry_date = res_data.get('plan_expiry_date', '').strip()
        user_id = str(res_data.get('user_id', '')).strip()
        
        customer_name = (
            res_data.get('customer_name') or 
            res_data.get('Customer name') or 
            res_data.get('Customer Name') or 
            res_data.get('customerName') or 
            ''
        ).strip()
        
        # Save to .system_data file using existing backend config function
        from .config_helper import save_config_values
        save_config_values({
            'company_name': company_name,
            'gst_number': gst_number,
            'pan_number': pan_number,
            'plan_expiry_date': plan_expiry_date,
            'license_key': token,
            'user_id': user_id,
        })
        
        # Conditionally create the local Django user
        if customer_name:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            if not User.objects.filter(username=customer_name).exists():
                User.objects.create_user(
                    username=customer_name,
                    password="1234",
                    is_staff=True,
                    is_superuser=True
                )
        
        return JsonResponse({
            'success': True,
            'company_name': company_name,
            'gst_number': gst_number,
            'pan_number': pan_number,
            'plan_expiry_date': plan_expiry_date,
            'active': True,
            'customer_name': customer_name,
            'user_id': user_id
        })
    else:
        error_msg = res_data.get('error') or res_data.get('message') or 'Invalid License'
        return JsonResponse({'error': error_msg}, status=400)

@api_login_required
def customer_list(request):
    query = request.GET.get('q', '')
    if query:
        customers = Customer.objects.filter(
            Q(name__icontains=query) | Q(gst_number__icontains=query)
        ).order_by('name')
    else:
        customers = Customer.objects.all().order_by('name')
        
    serialized = [serialize_customer(c) for c in customers]
    return JsonResponse(serialized, safe=False)

@api_login_required
def customer_get(request, pk):
    customer = get_object_or_404(Customer, pk=pk)
    return JsonResponse(serialize_customer(customer))

@api_login_required
def customer_add(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            form = CustomerForm(data)
            if form.is_valid():
                customer = form.save()
                return JsonResponse(serialize_customer(customer))
            else:
                return JsonResponse({'error': 'Invalid customer form.', 'details': form.errors}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def customer_edit(request, pk):
    customer = get_object_or_404(Customer, pk=pk)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            form = CustomerForm(data, instance=customer)
            if form.is_valid():
                customer = form.save()
                return JsonResponse(serialize_customer(customer))
            else:
                return JsonResponse({'error': 'Invalid customer form.', 'details': form.errors}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def customer_delete(request, pk):
    customer = get_object_or_404(Customer, pk=pk)
    if request.method == 'POST':
        name = customer.name
        customer.delete()
        return JsonResponse({'success': True, 'message': f"Customer '{name}' deleted successfully."})
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def customer_history(request, pk):
    customer = get_object_or_404(Customer, pk=pk)
    invoices = customer.invoices.all().order_by('-bill_date', '-created_at')
    
    serialized_invoices = []
    for inv in invoices:
        serialized_invoices.append({
            'id': inv.id,
            'bill_number': inv.bill_number,
            'bill_date': inv.bill_date.isoformat() if inv.bill_date else '',
            'challan_no': inv.challan_no,
            'hsn_code': inv.hsn_code,
            'amount': float(inv.amount)
        })
        
    return JsonResponse({
        'customer': serialize_customer(customer),
        'invoices': serialized_invoices
    })

@api_login_required
def invoice_list(request):
    q_bill = request.GET.get('q_bill', '')
    q_cust = request.GET.get('q_cust', '')
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    
    invoices = Invoice.objects.all().prefetch_related('items').order_by('-bill_date', '-created_at')
    
    if q_bill:
        invoices = invoices.filter(bill_number__icontains=q_bill)
    if q_cust:
        invoices = invoices.filter(Q(customer__name__icontains=q_cust) | Q(customer_name__icontains=q_cust))
    if date_from:
        invoices = invoices.filter(bill_date__gte=date_from)
    if date_to:
        invoices = invoices.filter(bill_date__lte=date_to)
        
    serialized = []
    for inv in invoices:
        serialized.append({
            'id': inv.id,
            'bill_number': inv.bill_number or '-',
            'customer_name': inv.display_customer_name,
            'bill_date': inv.bill_date.isoformat() if inv.bill_date else '',
            'amount': float(inv.amount),
            'note_type': inv.note_type or '',
            'note_amount': float(inv.note_amount or 0),
            'bank_name': inv.bank_name or '',
            'check_no': inv.check_no or '',
            'check_date': inv.check_date.isoformat() if inv.check_date else '',
            'tds': float(inv.tds or 0),
            'is_challan': inv.is_challan,
            'items': [serialize_invoice_item(item) for item in inv.items.all()]
        })
    return JsonResponse(serialized, safe=False)

@api_login_required
def invoice_add(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Sanitize Invoice decimal fields
            decimal_fields = [
                ('gross_amount', False),
                ('discount_percent', False),
                ('discount_amount', False),
                ('blouse_charge', False),
                ('extra_charges', False),
                ('subtotal', False),
                ('sgst_percent', False),
                ('sgst_amount', False),
                ('cgst_percent', False),
                ('cgst_amount', False),
                ('round_off', False),
                ('amount', False),
                ('tds', False),
                ('note_amount', False),
            ]
            
            for field, req in decimal_fields:
                if field in data:
                    try:
                        # Store as clean string representation for forms compatibility
                        data[field] = str(clean_decimal_value(data[field], field, req))
                    except ValidationError as ve:
                        return JsonResponse({'error': ve.message_dict if hasattr(ve, 'message_dict') else str(ve)}, status=400)
            
            form = InvoiceForm(data)
            items_data = data.get('items', [])
            
            if not items_data:
                return JsonResponse({'error': 'You must add at least one item to the product table.'}, status=400)
                
            if form.is_valid():
                with transaction.atomic():
                    invoice = form.save(commit=False)
                    dashboard_item_id = data.get('dashboard_item_id')
                    if dashboard_item_id:
                        invoice.dashboard_item_id = dashboard_item_id
                    if not invoice.is_challan:
                        invoice.bill_number = get_next_bill_number()
                    if invoice.customer:
                        invoice.customer_name = invoice.customer.name
                        invoice.customer_address = invoice.customer.address
                        invoice.customer_gst_number = invoice.customer.gst_number
                    else:
                        invoice.customer_name = (data.get('customer_name') or '').strip()
                        invoice.customer_address = (data.get('customer_address') or '').strip()
                        invoice.customer_gst_number = (data.get('customer_gst_number') or '').strip()
                    invoice.amount_in_words = number_to_words_indian(invoice.amount)
                    invoice.save()

                    # Mark individual dashboard products as 'Done'
                    billed_products = data.get('billed_products', [])
                    if billed_products:
                        _mark_dashboard_products_done(billed_products, invoice.id)
                    elif dashboard_item_id:
                        # Fallback: mark entire item done (legacy single-product behavior)
                        try:
                            db_item = DashboardItem.objects.get(id=dashboard_item_id)
                            db_item.status = 'Done'
                            db_item.save()
                        except DashboardItem.DoesNotExist:
                            pass
                    
                    for item in items_data:
                        # Sanitize item decimal fields
                        item_decimal_fields = ['meter', 't_qty', 'p_qty', 's_qty', 'qty', 'rate', 'amount']
                        cleaned_item = {}
                        for field in item_decimal_fields:
                            try:
                                cleaned_item[field] = clean_decimal_value(item.get(field), f"item.{field}")
                            except ValidationError as ve:
                                return JsonResponse({'error': ve.message_dict if hasattr(ve, 'message_dict') else str(ve)}, status=400)
                        
                        InvoiceItem.objects.create(
                            invoice=invoice,
                            p_ch_no=(item.get('p_ch_no') or '').strip(),
                            lot_no=(item.get('lot_no') or '').strip(),
                            design=(item.get('design') or '').strip(),
                            meter=cleaned_item['meter'],
                            t_qty=cleaned_item['t_qty'],
                            p_qty=cleaned_item['p_qty'],
                            s_qty=cleaned_item['s_qty'],
                            qty=cleaned_item['qty'],
                            rate=cleaned_item['rate'],
                            amount=cleaned_item['amount'],
                        )
                return JsonResponse(serialize_invoice(invoice))
            else:
                if 'bill_date' in form.errors and any('Your plan has expired' in e for e in form.errors['bill_date']):
                    return JsonResponse({'error': 'Your plan has expired.'}, status=400)
                return JsonResponse({'error': 'Invalid invoice data.', 'details': form.errors}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def invoice_edit(request, pk):
    invoice = get_object_or_404(Invoice, pk=pk)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Sanitize Invoice decimal fields
            decimal_fields = [
                ('gross_amount', False),
                ('discount_percent', False),
                ('discount_amount', False),
                ('blouse_charge', False),
                ('extra_charges', False),
                ('subtotal', False),
                ('sgst_percent', False),
                ('sgst_amount', False),
                ('cgst_percent', False),
                ('cgst_amount', False),
                ('round_off', False),
                ('amount', False),
                ('tds', False),
                ('note_amount', False),
            ]
            
            for field, req in decimal_fields:
                if field in data:
                    try:
                        # Store as clean string representation for forms compatibility
                        data[field] = str(clean_decimal_value(data[field], field, req))
                    except ValidationError as ve:
                        return JsonResponse({'error': ve.message_dict if hasattr(ve, 'message_dict') else str(ve)}, status=400)
            
            form = InvoiceForm(data, instance=invoice)
            items_data = data.get('items', [])
            
            if not items_data:
                return JsonResponse({'error': 'You must add at least one item to the product table.'}, status=400)
                
            if form.is_valid():
                with transaction.atomic():
                    invoice = form.save(commit=False)
                    if invoice.customer:
                        invoice.customer_name = invoice.customer.name
                        invoice.customer_address = invoice.customer.address
                        invoice.customer_gst_number = invoice.customer.gst_number
                    else:
                        invoice.customer_name = (data.get('customer_name') or '').strip()
                        invoice.customer_address = (data.get('customer_address') or '').strip()
                        invoice.customer_gst_number = (data.get('customer_gst_number') or '').strip()
                    invoice.amount_in_words = number_to_words_indian(invoice.amount)
                    invoice.save()
                    
                    # Revert previously linked dashboard products, then apply new ones
                    _revert_dashboard_products_for_invoice(invoice.id)
                    billed_products = data.get('billed_products', [])
                    if billed_products:
                        _mark_dashboard_products_done(billed_products, invoice.id)

                    # Delete old items and write new ones
                    invoice.items.all().delete()
                    for item in items_data:
                        # Sanitize item decimal fields
                        item_decimal_fields = ['meter', 't_qty', 'p_qty', 's_qty', 'qty', 'rate', 'amount']
                        cleaned_item = {}
                        for field in item_decimal_fields:
                            try:
                                cleaned_item[field] = clean_decimal_value(item.get(field), f"item.{field}")
                            except ValidationError as ve:
                                return JsonResponse({'error': ve.message_dict if hasattr(ve, 'message_dict') else str(ve)}, status=400)
                        
                        InvoiceItem.objects.create(
                            invoice=invoice,
                            p_ch_no=(item.get('p_ch_no') or '').strip(),
                            lot_no=(item.get('lot_no') or '').strip(),
                            design=(item.get('design') or '').strip(),
                            meter=cleaned_item['meter'],
                            t_qty=cleaned_item['t_qty'],
                            p_qty=cleaned_item['p_qty'],
                            s_qty=cleaned_item['s_qty'],
                            qty=cleaned_item['qty'],
                            rate=cleaned_item['rate'],
                            amount=cleaned_item['amount'],
                        )
                return JsonResponse(serialize_invoice(invoice))
            else:
                if 'bill_date' in form.errors and any('Your plan has expired' in e for e in form.errors['bill_date']):
                    return JsonResponse({'error': 'Your plan has expired.'}, status=400)
                return JsonResponse({'error': 'Invalid invoice data.', 'details': form.errors}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def invoice_update_payment(request, pk):
    invoice = get_object_or_404(Invoice, pk=pk)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            invoice.note_type = (data.get('note_type') or '').strip()
            note_amount = data.get('note_amount')
            if invoice.note_type:
                try:
                    invoice.note_amount = clean_decimal_value(note_amount, 'note_amount')
                except ValidationError as ve:
                    return JsonResponse({'error': ve.message_dict if hasattr(ve, 'message_dict') else str(ve)}, status=400)
            else:
                invoice.note_amount = 0.00
 
            invoice.bank_name = (data.get('bank_name') or '').strip()
            invoice.check_no = (data.get('check_no') or '').strip()
            
            check_date = data.get('check_date')
            if check_date == '' or check_date is None:
                invoice.check_date = None
            else:
                from datetime import datetime
                parsed_date = None
                for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d'):
                    try:
                        parsed_date = datetime.strptime(check_date, fmt).date()
                        break
                    except ValueError:
                        continue
                if parsed_date is None:
                    raise ValueError(f"Invalid date format: {check_date}")
                invoice.check_date = parsed_date
 
            tds = data.get('tds')
            try:
                invoice.tds = clean_decimal_value(tds, 'tds')
            except ValidationError as ve:
                return JsonResponse({'error': ve.message_dict if hasattr(ve, 'message_dict') else str(ve)}, status=400)
 
            invoice.save()
            return JsonResponse(serialize_invoice(invoice))
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def invoice_view(request, pk):
    invoice = get_object_or_404(Invoice, pk=pk)
    
    serialized_invoice = serialize_invoice(invoice)
    serialized_items = [serialize_invoice_item(item) for item in invoice.items.all()]
    serialized_invoice['items'] = serialized_items
    
    return JsonResponse(serialized_invoice)

@api_login_required
@xframe_options_exempt
def invoice_pdf(request, pk):
    invoice = get_object_or_404(Invoice, pk=pk)
    company = Company.objects.first()
    
    if not company:
        return HttpResponse("Please configure Company Settings first.", status=400)
        
    if getattr(invoice, 'is_challan', False):
        pdf_data = generate_challan_pdf(invoice, company)
        filename = f"Challan_{invoice.bill_number.replace('/', '_')}.pdf" if invoice.bill_number else f"Challan_{invoice.id}.pdf"
    else:
        pdf_data = generate_invoice_pdf(invoice, company)
        filename = f"Invoice_{invoice.bill_number.replace('/', '_')}.pdf" if invoice.bill_number else f"Invoice_{invoice.id}.pdf"
    
    response = HttpResponse(pdf_data, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    return response

@api_login_required
def invoice_delete(request, pk):
    invoice = get_object_or_404(Invoice, pk=pk)
    if request.method == 'POST':
        bill_number = invoice.bill_number
        with transaction.atomic():
            # Revert per-product statuses linked to this invoice
            _revert_dashboard_products_for_invoice(invoice.id)
            # Fallback: also revert the dashboard item FK if present
            if invoice.dashboard_item:
                # Only reset to Pending if no products are individually tracked
                products = []
                try:
                    products = json.loads(invoice.dashboard_item.products_json) if invoice.dashboard_item.products_json else []
                except Exception:
                    pass
                has_any_invoice_link = any(p.get('invoice_id') for p in products)
                if not has_any_invoice_link:
                    invoice.dashboard_item.status = 'Pending'
                    invoice.dashboard_item.save()
            invoice.delete()
        return JsonResponse({'success': True, 'message': f"Invoice {bill_number} deleted successfully."})
    return JsonResponse({'error': 'Method not allowed.'}, status=405)


@api_login_required
@xframe_options_exempt
def invoice_pdf_bulk(request):
    ids_str = request.GET.get('ids', '')
    if not ids_str:
        return HttpResponse("No invoice IDs provided.", status=400)
        
    try:
        ids = [int(x) for x in ids_str.split(',') if x.strip()]
    except ValueError:
        return HttpResponse("Invalid invoice IDs format.", status=400)
        
    if not ids:
        return HttpResponse("No invoice IDs provided.", status=400)
        
    company = Company.objects.first()
    if not company:
        return HttpResponse("Please configure Company Settings first.", status=400)
        
    db_invoices = Invoice.objects.filter(id__in=ids)
    if not db_invoices.exists():
        return HttpResponse("Invoices not found.", status=404)
        
    # Preserve the selection order of the passed IDs
    invoice_map = {inv.id: inv for inv in db_invoices}
    invoices = [invoice_map[inv_id] for inv_id in ids if inv_id in invoice_map]
    
    # Determine if this is a bulk print of delivery challans or tax invoices
    is_challan_bulk = any(getattr(inv, 'is_challan', False) for inv in invoices)
    if is_challan_bulk:
        pdf_data = generate_bulk_challan_pdf(invoices, company)
        filename = "Challans_Bulk.pdf"
    else:
        pdf_data = generate_bulk_invoice_pdf(invoices, company)
        filename = "Invoices_Bulk.pdf"
    
    response = HttpResponse(pdf_data, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


# ─── Dashboard Items API ───────────────────────────────────────────────

def serialize_dashboard_item(item):
    products = []
    if item.products_json:
        try:
            products = json.loads(item.products_json)
        except Exception:
            pass
    if not products:
        products = [{
            'design': item.design or '',
            'lot_no': item.lot_no or '',
            'meter': float(item.meter or 0),
            'qty': float(item.qty or 0),
            'rate': float(item.rate or 0),
            'hsn_code': item.hsn_code or '',
            'status': item.status or 'Pending'
        }]
    
    total_qty = sum(float(p.get('qty') or 0) for p in products)
    total_amount = sum(float(p.get('qty') or 0) * float(p.get('rate') or 0) for p in products)
    total_meter = sum(float(p.get('meter') or 0) for p in products)
    
    design_str = ", ".join(p.get('design', '') for p in products if p.get('design'))
    if not design_str and item.design:
        design_str = item.design
        
    return {
        'id': item.id,
        'customer_name': item.customer_name,
        'date': item.date.isoformat() if hasattr(item.date, 'isoformat') else (item.date or ''),
        'design': design_str,
        'qty': total_qty,
        'rate': float(products[0].get('rate') or 0) if len(products) == 1 else 0.0,
        'meter': total_meter,
        'total': total_amount,
        'status': item.status,
        'p_ch_no': item.p_ch_no,
        'lot_no': products[0].get('lot_no', '') if len(products) == 1 else '',
        'gst_number': item.gst_number,
        'billing_address': item.billing_address,
        'hsn_code': products[0].get('hsn_code', '') if len(products) == 1 else '',
        'broker': item.broker,
        'products': products,
    }

@api_login_required
def dashboard_items_list(request):
    items = DashboardItem.objects.all()
    return JsonResponse([serialize_dashboard_item(i) for i in items], safe=False)

@api_login_required
def dashboard_item_add(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            products = data.get('products', [])
            if not products:
                products = [{
                    'design': (data.get('design') or '').strip(),
                    'lot_no': (data.get('lot_no') or '').strip(),
                    'meter': float(data.get('meter', 0)),
                    'qty': float(data.get('qty', 0)),
                    'rate': float(data.get('rate', 0)),
                    'hsn_code': (data.get('hsn_code') or '').strip()
                }]
                
            total_qty = sum(float(p.get('qty') or 0) for p in products)
            total_amount = sum(float(p.get('qty') or 0) * float(p.get('rate') or 0) for p in products)
            total_meter = sum(float(p.get('meter') or 0) for p in products)
            first_p = products[0] if products else {}
            
            item = DashboardItem.objects.create(
                customer_name=(data.get('customer_name') or '').strip(),
                date=data.get('date'),
                design=(first_p.get('design') or '').strip(),
                qty=total_qty,
                rate=float(first_p.get('rate') or 0),
                meter=total_meter,
                total=total_amount,
                status=data.get('status', 'Pending'),
                p_ch_no=(data.get('p_ch_no') or '').strip(),
                lot_no=(first_p.get('lot_no') or '').strip(),
                gst_number=(data.get('gst_number') or '').strip(),
                billing_address=(data.get('billing_address') or '').strip(),
                hsn_code=(first_p.get('hsn_code') or '').strip(),
                broker=(data.get('broker') or '').strip(),
                products_json=json.dumps(products)
            )
            return JsonResponse(serialize_dashboard_item(item), status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def dashboard_item_edit(request, pk):
    item = get_object_or_404(DashboardItem, pk=pk)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            products = data.get('products', [])
            if not products:
                products = [{
                    'design': (data.get('design') or '').strip(),
                    'lot_no': (data.get('lot_no') or '').strip(),
                    'meter': float(data.get('meter', 0)),
                    'qty': float(data.get('qty', 0)),
                    'rate': float(data.get('rate', 0)),
                    'hsn_code': (data.get('hsn_code') or '').strip()
                }]
                
            total_qty = sum(float(p.get('qty') or 0) for p in products)
            total_amount = sum(float(p.get('qty') or 0) * float(p.get('rate') or 0) for p in products)
            total_meter = sum(float(p.get('meter') or 0) for p in products)
            first_p = products[0] if products else {}
            
            item.customer_name = (data.get('customer_name') or item.customer_name).strip()
            item.date = data.get('date', item.date)
            item.design = (first_p.get('design') or '').strip()
            item.qty = total_qty
            item.rate = float(first_p.get('rate') or 0)
            item.meter = total_meter
            item.total = total_amount
            item.status = data.get('status', item.status)
            item.p_ch_no = (data.get('p_ch_no') or '').strip()
            item.lot_no = (first_p.get('lot_no') or '').strip()
            item.gst_number = (data.get('gst_number') or '').strip()
            item.billing_address = (data.get('billing_address') or '').strip()
            item.hsn_code = (first_p.get('hsn_code') or '').strip()
            item.broker = (data.get('broker') or '').strip()
            item.products_json = json.dumps(products)
            item.save()
            return JsonResponse(serialize_dashboard_item(item))
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@api_login_required
def dashboard_item_delete(request, pk):
    item = get_object_or_404(DashboardItem, pk=pk)
    if request.method == 'POST':
        if item.status == 'Done':
            return JsonResponse({'error': 'Done items cannot be deleted.'}, status=400)
        item.delete()
        return JsonResponse({'success': True})
    return JsonResponse({'error': 'Method not allowed.'}, status=405)
