from django.conf import settings

class HeaderSessionMiddleware:
    """
    Middleware that enables session authentication via HTTP headers
    (Authorization: Session <session_key> or X-Session-ID: <session_key>)
    for cross-origin clients (such as mobile phone browsers and PWAs)
    where third-party cookies are blocked by default (e.g. iOS Safari ITP).
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.COOKIES.get(settings.SESSION_COOKIE_NAME):
            auth_header = request.headers.get('Authorization', '')
            session_key = None
            if auth_header.startswith('Session '):
                session_key = auth_header.split(' ', 1)[1].strip()
            elif 'HTTP_X_SESSION_ID' in request.META:
                session_key = request.META['HTTP_X_SESSION_ID'].strip()
            elif 'X-Session-ID' in request.headers:
                session_key = request.headers['X-Session-ID'].strip()

            if session_key:
                request.COOKIES[settings.SESSION_COOKIE_NAME] = session_key

        return self.get_response(request)
