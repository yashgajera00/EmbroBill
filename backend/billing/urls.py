from django.urls import path
from . import views

urlpatterns = [
    path('auth/status/', views.auth_status, name='api_auth_status'),
    path('login/', views.login_view, name='api_login'),
    path('logout/', views.logout_view, name='api_logout'),
    path('change-password/', views.change_password, name='api_change_password'),
    path('verify-password/', views.verify_password, name='api_verify_password'),
    path('settings/', views.company_settings, name='api_company_settings'),
    path('license/', views.activate_license, name='api_activate_license'),
    
    # Customer API routes
    path('customers/', views.customer_list, name='api_customer_list'),
    path('customers/<int:pk>/', views.customer_get, name='api_customer_get'),
    path('customers/add/', views.customer_add, name='api_customer_add'),
    path('customers/edit/<int:pk>/', views.customer_edit, name='api_customer_edit'),
    path('customers/delete/<int:pk>/', views.customer_delete, name='api_customer_delete'),
    path('customers/history/<int:pk>/', views.customer_history, name='api_customer_history'),
    
    # Invoice API routes
    path('invoices/', views.invoice_list, name='api_invoice_list'),
    path('invoices/next-bill-number/', views.next_bill_number_view, name='api_next_bill_number'),
    path('invoices/add/', views.invoice_add, name='api_invoice_add'),
    path('invoices/edit/<int:pk>/', views.invoice_edit, name='api_invoice_edit'),
    path('invoices/update-payment/<int:pk>/', views.invoice_update_payment, name='api_invoice_update_payment'),
    path('invoices/view/<int:pk>/', views.invoice_view, name='api_invoice_view'),
    path('invoices/pdf/bulk/', views.invoice_pdf_bulk, name='api_invoice_pdf_bulk'),
    path('invoices/pdf/<int:pk>/', views.invoice_pdf, name='api_invoice_pdf'),
    path('invoices/delete/<int:pk>/', views.invoice_delete, name='api_invoice_delete'),

    # Dashboard Items API routes (separate from invoices)
    path('dashboard-items/', views.dashboard_items_list, name='api_dashboard_items_list'),
    path('dashboard-items/add/', views.dashboard_item_add, name='api_dashboard_item_add'),
    path('dashboard-items/edit/<int:pk>/', views.dashboard_item_edit, name='api_dashboard_item_edit'),
    path('dashboard-items/delete/<int:pk>/', views.dashboard_item_delete, name='api_dashboard_item_delete'),
]
