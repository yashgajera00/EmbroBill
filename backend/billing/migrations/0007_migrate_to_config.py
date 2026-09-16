from django.db import migrations

def migrate_to_config(apps, schema_editor):
    Company = apps.get_model('billing', 'Company')
    company = Company.objects.first()
    if company:
        from billing.config_helper import save_config_values
        
        # Read from model (before schema change removes the fields)
        company_name = getattr(company, 'company_name', None)
        gst_number = getattr(company, 'gst_number', None)
        pan_number = getattr(company, 'pan_number', None)
        plan_expiry_date = getattr(company, 'plan_expiry_date', None)
        
        save_config_values({
            'company_name': company_name,
            'gst_number': gst_number,
            'pan_number': pan_number,
            'plan_expiry_date': plan_expiry_date,
        })

class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0006_invoice_bank_name_invoice_check_date_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_to_config),
    ]
