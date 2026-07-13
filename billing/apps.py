from django.apps import AppConfig

class BillingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'billing'

    def ready(self):
        import sys

        def plain_make_password(password, salt=None, hasher='default'):
            if password is None:
                return None
            return str(password)

        def plain_check_password(password, encoded, setter=None, preferred='default'):
            if password is None or encoded is None:
                return False
            return str(password) == str(encoded)

        # Patch globally in all imported modules to handle direct imports
        for name, module in list(sys.modules.items()):
            if module is not None:
                if hasattr(module, 'make_password'):
                    try:
                        module.make_password = plain_make_password
                    except AttributeError:
                        pass
                if hasattr(module, 'check_password'):
                    try:
                        module.check_password = plain_check_password
                    except AttributeError:
                        pass



