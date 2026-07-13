import os
from pathlib import Path
from .settings import *

# Identify Windows user AppData directory (e.g., C:\Users\<Username>\AppData\Roaming)
app_data = os.environ.get('APPDATA') or os.environ.get('LOCALAPPDATA')

if app_data:
    # Store database in AppData\Roaming\SuratTextileBilling
    desktop_data_dir = Path(app_data) / 'SuratTextileBilling'
    desktop_data_dir.mkdir(parents=True, exist_ok=True)
    DATABASES['default']['NAME'] = desktop_data_dir / 'db.sqlite3'
    print(f"[Desktop Settings] Using persistent database at: {DATABASES['default']['NAME']}")
else:
    # Fallback to standard location if environment variables are not found
    DATABASES['default']['NAME'] = BASE_DIR / 'db.sqlite3'
    print(f"[Desktop Settings] Fallback database path: {DATABASES['default']['NAME']}")

# Custom CORS middleware to support dev mode in standard web browsers
class CORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == 'OPTIONS':
            from django.http import HttpResponse
            response = HttpResponse()
        else:
            response = self.get_response(request)
        
        origin = request.META.get('HTTP_ORIGIN')
        if origin:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
        else:
            response['Access-Control-Allow-Origin'] = '*'
            
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRFToken, Cookie, Accept'
        return response

# Insert CORSMiddleware at the beginning and remove CsrfViewMiddleware
MIDDLEWARE = ['bill_system.desktop_settings.CORSMiddleware'] + [m for m in MIDDLEWARE if m != 'django.middleware.csrf.CsrfViewMiddleware']

CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_SAMESITE = None
SESSION_COOKIE_SECURE = False

CSRF_COOKIE_SAMESITE = None
CSRF_COOKIE_SECURE = False
