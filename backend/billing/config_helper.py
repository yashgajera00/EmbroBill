from datetime import datetime, date

def parse_date(val):
    if not val:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None

def load_config():
    """Load company configuration directly from the database."""
    try:
        from .models import Company
        company = Company.objects.first()
        if company:
            return {
                'company_name': company.company_name or '',
                'gst_number': company.gst_number or '',
                'pan_number': company.pan_number or '',
                'plan_expiry_date': company.plan_expiry_date.isoformat() if company.plan_expiry_date else '',
                'license_key': company.license_key or '',
                'user_id': company.user_id or '',
            }
    except Exception as e:
        print(f"[Config Helper] Error loading config from database: {e}")

    return {
        'company_name': '',
        'gst_number': '',
        'pan_number': '',
        'plan_expiry_date': '',
        'license_key': '',
        'user_id': '',
    }

def get_config_value(key):
    config = load_config()
    return config.get(key, '')

def save_config_values(values):
    """Save company configuration values directly to the database."""
    try:
        from .models import Company
        company = Company.objects.first()
        if not company:
            company = Company.objects.create()

        if 'company_name' in values:
            company.company_name = str(values['company_name'] or '').strip()
        if 'gst_number' in values:
            company.gst_number = str(values['gst_number'] or '').strip()
        if 'pan_number' in values:
            company.pan_number = str(values['pan_number'] or '').strip()
        if 'plan_expiry_date' in values:
            val = values['plan_expiry_date']
            company.plan_expiry_date = parse_date(val) if val else None
        if 'license_key' in values:
            company.license_key = str(values['license_key'] or '').strip()
        if 'user_id' in values:
            company.user_id = str(values['user_id'] or '').strip()

        company.save()
        return True
    except Exception as e:
        print(f"[Config Helper] Error saving config to database: {e}")
        return False
