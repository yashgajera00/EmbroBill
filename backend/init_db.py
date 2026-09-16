import os
import django
import sys

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bill_system.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.core.management import call_command
from billing.models import Company

def initialize():
    print("Step 1: Running Database Migrations...")
    call_command('migrate')
    
    print("\nStep 2: Initializing Default Company Settings...")
    if not Company.objects.exists():
        Company.objects.create(
            address="",
            phone="",
            bank_name="",
            account_number="",
            ifsc_code="",
            terms_conditions=(
                "1) Goods Once Sold will not be taken back.\n"
                "2) Goods are delivered at owner's risk and insurance option.\n"
                "3) Please Check The RF Within 5 Days Otherwise We Are Not Responsible.\n"
                "4) Interest will be charged @ 24% p.a.\n"
                "5) Subject to SURAT Jurisdiction."
            )
        )
        print("Default company settings initialized successfully!")
    else:
        print("Company settings already exist.")

    print("\nInitialization Complete. You can run the server using: python manage.py runserver")

if __name__ == '__main__':
    initialize()
