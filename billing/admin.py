from django.contrib import admin
from .models import Company, Customer, Invoice, InvoiceItem

class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('bill_number', 'customer', 'bill_date', 'amount', 'created_at')
    search_fields = ('bill_number', 'customer__name', 'challan_no')
    list_filter = ('bill_date', 'created_at')
    inlines = [InvoiceItemInline]

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'gst_number')
    search_fields = ('name', 'gst_number')

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'gst_number', 'phone')

@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'p_ch_no', 'lot_no', 'design', 'qty', 'rate', 'amount')
