import os
import json
import base64
from pathlib import Path
from django.conf import settings
from datetime import datetime, date

# Simple XOR obfuscation key
OBFUSCATION_KEY = b"EmbroBillSecretSecureKey2026!"

# Default configuration values obfuscated using standard base64 and custom XOR
DEFAULT_COMPANY_NAME = 'BCwxJicDSS8+FiQ3Oyo6'
DEFAULT_GST_NUMBER = 'd1khPzoSOV1bYlcpQz8m'
DEFAULT_PAN_NUMBER = 'BiA3Ij9zXl1eGQ=='
DEFAULT_PLAN_EXPIRY_DATE = 'd11QRUJyX0FeZw=='

def obfuscate(value: str) -> str:
    if not value:
        return ""
    # Convert string to UTF-8 bytes, XOR with key, then base64 encode
    raw_bytes = value.encode('utf-8')
    obfuscated_bytes = bytes([b ^ OBFUSCATION_KEY[i % len(OBFUSCATION_KEY)] for i, b in enumerate(raw_bytes)])
    return base64.b64encode(obfuscated_bytes).decode('utf-8')

def deobfuscate(obfuscated_str: str) -> str:
    if not obfuscated_str:
        return ""
    try:
        obfuscated_bytes = base64.b64decode(obfuscated_str.encode('utf-8'))
        raw_bytes = bytes([b ^ OBFUSCATION_KEY[i % len(OBFUSCATION_KEY)] for i, b in enumerate(obfuscated_bytes)])
        return raw_bytes.decode('utf-8')
    except Exception:
        return ""

def get_protected_data_path():
    try:
        db_path = settings.DATABASES['default']['NAME']
        return Path(db_path).parent / '.system_data'
    except Exception:
        # Fallback to base directory
        return Path(settings.BASE_DIR) / '.system_data'

def load_config():
    # 1. Initialize config with deobfuscated default values
    config = {
        'company_name': deobfuscate(DEFAULT_COMPANY_NAME),
        'gst_number': deobfuscate(DEFAULT_GST_NUMBER),
        'pan_number': deobfuscate(DEFAULT_PAN_NUMBER),
        'plan_expiry_date': deobfuscate(DEFAULT_PLAN_EXPIRY_DATE),
        'license_key': '',
        'user_id': '',
    }
    
    # 2. Next, overlay values from the dynamic protected binary file if it exists
    try:
        protected_file = get_protected_data_path()
        if protected_file.exists():
            obfuscated_str = protected_file.read_bytes().decode('utf-8')
            data_str = deobfuscate(obfuscated_str)
            if data_str:
                saved_config = json.loads(data_str)
                # Map variables to config keys
                var_keys = ['company_name', 'gst_number', 'pan_number', 'plan_expiry_date', 'license_key', 'user_id']
                for key in var_keys:
                    if key in saved_config:
                        val = saved_config[key]
                        if val is None:
                            config[key] = ''
                        else:
                            config[key] = str(val).strip()
    except Exception as e:
        print(f"[Config Helper] Error loading protected config: {e}")

    # 3. Overlay environment variables if present (takes precedence over all)
    env_mapping = {
        'COMPANY_NAME': 'company_name',
        'GST_NUMBER': 'gst_number',
        'PAN_NUMBER': 'pan_number',
        'PLAN_EXPIRY_DATE': 'plan_expiry_date',
    }
    for env_key, config_key in env_mapping.items():
        val = os.environ.get(env_key)
        if val is not None:
            config[config_key] = val

    # Standardize empty/None values to empty strings
    for k in config:
        if config[k] is None:
            config[k] = ''

    return config

def get_config_value(key):
    config = load_config()
    val = config.get(key)
    if val is None:
        return ''
    return val

def save_config_values(values):
    try:
        protected_file = get_protected_data_path()
    except Exception as e:
        print(f"[Config Helper] Error resolving protected path: {e}")
        return False
        
    # First, load the existing values to preserve anything not in values
    current_config = load_config()
    
    # Update with new values
    for k, v in values.items():
        if k in current_config:
            if v is None:
                current_config[k] = ''
            elif isinstance(v, (date, datetime)):
                current_config[k] = v.isoformat()
            else:
                current_config[k] = str(v).strip()
                
    # Prepare serializable content and obfuscate it
    try:
        data_str = json.dumps(current_config)
        obfuscated_str = obfuscate(data_str)
        
        protected_file.parent.mkdir(parents=True, exist_ok=True)
        protected_file.write_bytes(obfuscated_str.encode('utf-8'))
        return True
    except Exception as e:
        print(f"[Config Helper] Error writing protected config: {e}")
        return False

def parse_date(val):
    if not val:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    # Try parsing string
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            continue
    return None
