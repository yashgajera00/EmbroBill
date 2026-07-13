from django import forms
from .models import Company, Customer, Invoice

class CompanyForm(forms.ModelForm):
    company_name = forms.CharField(
        max_length=150, 
        required=False, 
        widget=forms.TextInput(attrs={'class': 'form-control'})
    )
    gst_number = forms.CharField(
        max_length=15, 
        required=False, 
        widget=forms.TextInput(attrs={'class': 'form-control'})
    )
    pan_number = forms.CharField(
        max_length=10, 
        required=False, 
        widget=forms.TextInput(attrs={'class': 'form-control'})
    )
    plan_expiry_date = forms.DateField(
        required=False, 
        widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'})
    )

    class Meta:
        model = Company
        fields = [
            'address', 'phone', 'state_code', 'bank_name', 
            'account_number', 'ifsc_code', 'terms_conditions'
        ]
        widgets = {
            'address': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'phone': forms.TextInput(attrs={'class': 'form-control'}),
            'state_code': forms.TextInput(attrs={'class': 'form-control'}),
            'bank_name': forms.TextInput(attrs={'class': 'form-control'}),
            'account_number': forms.TextInput(attrs={'class': 'form-control'}),
            'ifsc_code': forms.TextInput(attrs={'class': 'form-control'}),
            'terms_conditions': forms.Textarea(attrs={'class': 'form-control', 'rows': 5}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from .config_helper import get_config_value, parse_date
        
        # Populate initial values from config helper
        self.fields['company_name'].initial = get_config_value('company_name')
        self.fields['gst_number'].initial = get_config_value('gst_number')
        self.fields['pan_number'].initial = get_config_value('pan_number')
        
        expiry = parse_date(get_config_value('plan_expiry_date'))
        if expiry:
            self.fields['plan_expiry_date'].initial = expiry



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
            'bill_number', 'customer', 'challan_no', 'broker', 'hsn_code', 'bill_date',
            'gross_amount', 'discount_percent', 'discount_amount',
            'blouse_charge', 'subtotal', 'sgst_percent', 'sgst_amount',
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
        bill_date = self.cleaned_data.get('bill_date')
        if bill_date:
            company = Company.objects.first()
            if company and company.plan_expiry_date:
                if bill_date > company.plan_expiry_date:
                    raise forms.ValidationError("Your plan has expired.")
        return bill_date
