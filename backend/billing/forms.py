from django import forms
from .models import Company, Customer, Invoice

class CompanyForm(forms.ModelForm):
    class Meta:
        model = Company
        fields = [
            'company_name', 'gst_number', 'pan_number', 'plan_expiry_date',
            'license_key', 'user_id',
            'address', 'phone', 'state_code', 'bank_name', 
            'account_number', 'ifsc_code', 'terms_conditions',
            'bill_no_prefix', 'bill_no_start_number', 'default_hsn_code'
        ]
        widgets = {
            'company_name': forms.TextInput(attrs={'class': 'form-control'}),
            'gst_number': forms.TextInput(attrs={'class': 'form-control'}),
            'pan_number': forms.TextInput(attrs={'class': 'form-control'}),
            'plan_expiry_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'license_key': forms.TextInput(attrs={'class': 'form-control'}),
            'user_id': forms.TextInput(attrs={'class': 'form-control'}),
            'address': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'phone': forms.TextInput(attrs={'class': 'form-control'}),
            'state_code': forms.TextInput(attrs={'class': 'form-control'}),
            'bank_name': forms.TextInput(attrs={'class': 'form-control'}),
            'account_number': forms.TextInput(attrs={'class': 'form-control'}),
            'ifsc_code': forms.TextInput(attrs={'class': 'form-control'}),
            'terms_conditions': forms.Textarea(attrs={'class': 'form-control', 'rows': 5}),
            'bill_no_prefix': forms.TextInput(attrs={'class': 'form-control'}),
            'bill_no_start_number': forms.NumberInput(attrs={'class': 'form-control', 'min': '1'}),
            'default_hsn_code': forms.TextInput(attrs={'class': 'form-control'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.required = False



class CustomerForm(forms.ModelForm):
    class Meta:
        model = Customer
        fields = ['name', 'address', 'gst_number']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'address': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'gst_number': forms.TextInput(attrs={'class': 'form-control'}),
        }

    def clean_gst_number(self):
        gst_number = self.cleaned_data.get('gst_number')
        if gst_number:
            gst_number = gst_number.strip().upper()
        return gst_number


class InvoiceForm(forms.ModelForm):
    class Meta:
        model = Invoice
        fields = [
            'bill_number', 'customer', 'dashboard_item', 'challan_no', 'broker', 'hsn_code', 'bill_date',
            'gross_amount', 'discount_percent', 'discount_amount',
            'blouse_charge', 'extra_charges', 'extra_charges_type', 'extra_charges_reason', 'subtotal', 'sgst_percent', 'sgst_amount',
            'cgst_percent', 'cgst_amount', 'round_off', 'amount',
            'amount_in_words', 'is_challan', 'note_type', 'note_amount', 'bank_name', 'check_no', 'check_date', 'tds'
        ]
        widgets = {
            'bill_number': forms.TextInput(attrs={'class': 'form-control'}),
            'customer': forms.Select(attrs={'class': 'form-select'}),
            'challan_no': forms.TextInput(attrs={'class': 'form-control'}),
            'broker': forms.TextInput(attrs={'class': 'form-control'}),
            'hsn_code': forms.TextInput(attrs={'class': 'form-control'}),
            'bill_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'gross_amount': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'discount_percent': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'discount_amount': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'blouse_charge': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'extra_charges': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'extra_charges_type': forms.TextInput(attrs={'class': 'form-control'}),
            'extra_charges_reason': forms.TextInput(attrs={'class': 'form-control'}),
            'subtotal': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'sgst_percent': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'sgst_amount': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'cgst_percent': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'cgst_amount': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'round_off': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'amount': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'amount_in_words': forms.TextInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'is_challan': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'note_type': forms.Select(attrs={'class': 'form-select'}),
            'note_amount': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'bank_name': forms.TextInput(attrs={'class': 'form-control'}),
            'check_no': forms.TextInput(attrs={'class': 'form-control'}),
            'check_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'tds': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
        }

    def clean_bill_number(self):
        bill_number = self.cleaned_data.get('bill_number')
        if not bill_number or not bill_number.strip():
            return None
        return bill_number.strip()

    def clean_bill_date(self):
        return self.cleaned_data.get('bill_date')
