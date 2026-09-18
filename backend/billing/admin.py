from django.contrib import admin
from .models import Company, Customer, Invoice, InvoiceItem, DashboardItem

class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('bill_number', 'user', 'customer', 'bill_date', 'amount', 'created_at')
    search_fields = ('bill_number', 'customer__name', 'challan_no', 'user__username')
    list_filter = ('user', 'bill_date', 'created_at')
    inlines = [InvoiceItemInline]

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'gst_number')
    search_fields = ('name', 'gst_number', 'user__username')
    list_filter = ('user',)

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'user', 'gst_number', 'phone')
    search_fields = ('company_name', 'gst_number', 'user__username')
    list_filter = ('user',)

@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'p_ch_no', 'lot_no', 'design', 'qty', 'rate', 'amount')

@admin.register(DashboardItem)
class DashboardItemAdmin(admin.ModelAdmin):
    list_display = ('customer_name', 'user', 'date', 'design', 'qty', 'total', 'status')
    search_fields = ('customer_name', 'design', 'user__username')
    list_filter = ('user', 'status', 'date')
