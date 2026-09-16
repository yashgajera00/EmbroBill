import os
import sys
import django
from pathlib import Path

# Setup Django Environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bill_system.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from billing.models import Company, Customer, Invoice, InvoiceItem
from billing.config_helper import get_protected_data_path

def perform_reset():
    print("--- EmbroBill First-Installation Reset Process ---")
    
    # 1. Delete all local Django users from the auth_user table
    User = get_user_model()
    user_count = User.objects.all().delete()[0]
    print(f"Deleted {user_count} user(s) from auth_user table.")
    
    # 2. Delete all local session data
    session_count = Session.objects.all().delete()[0]
    print(f"Deleted {session_count} session(s) from session data.")
    
    # 3. Delete all local authentication tokens if any exist
    from django.apps import apps
    token_deleted = 0
    if apps.is_installed('rest_framework.authtoken'):
        try:
            Token = apps.get_model('authtoken', 'Token')
            token_deleted = Token.objects.all().delete()[0]
        except Exception as e:
            print(f"Warning deleting DRF tokens: {e}")
    print(f"Deleted {token_deleted} authentication token(s).")
    
    # Delete customers, invoices, invoice items (to ensure no customer identity data exists locally)
    invoice_item_count = InvoiceItem.objects.all().delete()[0]
    invoice_count = Invoice.objects.all().delete()[0]
    customer_count = Customer.objects.all().delete()[0]
    print(f"Deleted {invoice_item_count} invoice items, {invoice_count} invoices, and {customer_count} customers.")

    # 4. Delete all existing Company records
    company_count = Company.objects.all().delete()[0]
    print(f"Deleted {company_count} company record(s).")
    
    # 5. Delete or reset the existing .system_data file
    try:
        protected_file = get_protected_data_path()
        if protected_file.exists():
            protected_file.unlink()
            print(f"Deleted protected config file: {protected_file}")
        else:
            print("Protected config file .system_data did not exist.")
    except Exception as e:
        print(f"Error deleting protected config file: {e}")
        
    # 6. Run the existing initialization process
    # This recreates a blank Company record with defaults
    print("Re-running database initialization...")
    Company.objects.create(
        address="",
        phone="",
        bank_name="",
        account_number="",
        ifsc_code=""
    )
    print("Created blank Company record with model defaults.")
    
    # 7. Verification checks
    print("\n--- Verifying Reset State ---")
    
    # Check users count
    final_users = User.objects.count()
    print(f"Users in auth_user: {final_users}")
    assert final_users == 0, f"Expected 0 users, found {final_users}"
    
    # Check company count
    final_companies = Company.objects.count()
    print(f"Company records: {final_companies}")
    assert final_companies == 1, f"Expected 1 Company record, found {final_companies}"
    
    # Check company fields
    c = Company.objects.first()
    print(f"Company State Code: {c.state_code}")
    print(f"Company Address: {repr(c.address)}")
    print(f"Company Phone: {repr(c.phone)}")
    print(f"Company Bank Name: {repr(c.bank_name)}")
    print(f"Company Account Number: {repr(c.account_number)}")
    print(f"Company IFSC Code: {repr(c.ifsc_code)}")
    print(f"Company Terms: {repr(c.terms_conditions)}")
    
    assert c.state_code == "24-GJ", f"Expected '24-GJ', found {c.state_code}"
    assert c.address == "", "Company address must be blank."
    assert c.phone == "", "Company phone must be blank."
    assert c.bank_name == "", "Company bank_name must be blank."
    assert c.account_number == "", "Company account_number must be blank."
    assert c.ifsc_code == "", "Company ifsc_code must be blank."
    
    # Verify .system_data does not exist or contains no activated license info
    try:
        from billing.config_helper import load_config
        config = load_config()
        print(f"License Key: {repr(config.get('license_key'))}")
        print(f"Company Name: {repr(config.get('company_name'))}")
        print(f"GST Number: {repr(config.get('gst_number'))}")
        print(f"PAN Number: {repr(config.get('pan_number'))}")
        print(f"Plan Expiry Date: {repr(config.get('plan_expiry_date'))}")
        
        assert not config.get('license_key'), "License key must be empty after reset."
    except Exception as e:
        print(f"Warning during config verification: {e}")
        
    # Verify customers
    final_customers = Customer.objects.count()
    print(f"Customer records: {final_customers}")
    assert final_customers == 0, f"Expected 0 customers, found {final_customers}"
    
    print("\n[SUCCESS] Environment reset successful! Brand-new installation simulation configured.")

if __name__ == '__main__':
    perform_reset()
