from django.db import models

class Company(models.Model):
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    state_code = models.CharField(max_length=10, default="24-GJ", blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    account_number = models.CharField(max_length=30, blank=True, null=True)
    ifsc_code = models.CharField(max_length=20, blank=True, null=True)
    terms_conditions = models.TextField(
        blank=True, null=True,
        default="1) Goods Once Sold will not be taken back.\n"
                "2) Goods are delivered at owner's risk and insurance option.\n"
                "3) Please Check The RF Within 5 Days Otherwise We Are Not Responsible.\n"
                "4) Interest will be charged @ 24% p.a.\n"
                "5) Subject to SURAT Jurisdiction."
    )
    bill_no_prefix = models.CharField(max_length=50, blank=True, null=True, default="")
    bill_no_start_number = models.IntegerField(default=1)
    default_hsn_code = models.CharField(max_length=50, blank=True, null=True, default="")

    @property
    def company_name(self):
        from .config_helper import get_config_value
        return get_config_value('company_name')

    @company_name.setter
    def company_name(self, value):
        from .config_helper import save_config_values
        save_config_values({'company_name': value})

    @property
    def gst_number(self):
        from .config_helper import get_config_value
        return get_config_value('gst_number')

    @gst_number.setter
    def gst_number(self, value):
        from .config_helper import save_config_values
        save_config_values({'gst_number': value})

    @property
    def pan_number(self):
        from .config_helper import get_config_value
        return get_config_value('pan_number')

    @pan_number.setter
    def pan_number(self, value):
        from .config_helper import save_config_values
        save_config_values({'pan_number': value})

    @property
    def plan_expiry_date(self):
        from .config_helper import get_config_value, parse_date
        return parse_date(get_config_value('plan_expiry_date'))

    @plan_expiry_date.setter
    def plan_expiry_date(self, value):
        from .config_helper import save_config_values
        import datetime
        if isinstance(value, (datetime.date, datetime.datetime)):
            value = value.isoformat()
        save_config_values({'plan_expiry_date': value})

    @property
    def user_id(self):
        from .config_helper import get_config_value
        return get_config_value('user_id')

    @user_id.setter
    def user_id(self, value):
        from .config_helper import save_config_values
        save_config_values({'user_id': value})

    class Meta:
        verbose_name_plural = "Company Settings"

    def __str__(self):
        return self.company_name or ""


class Customer(models.Model):
    name = models.CharField(max_length=150)
    address = models.TextField(blank=True, default="")
    gst_number = models.CharField(max_length=15, blank=True, default="")

    def __str__(self):
        return self.name


class Invoice(models.Model):
    bill_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    dashboard_item = models.ForeignKey('DashboardItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    customer_name = models.CharField(max_length=150, blank=True, default="")
    customer_address = models.TextField(blank=True, default="")
    customer_gst_number = models.CharField(max_length=15, blank=True, default="")
    challan_no = models.CharField(max_length=100, blank=True, null=True)
    broker = models.CharField(max_length=100, blank=True, null=True)
    hsn_code = models.CharField(max_length=50, blank=True, null=True)
    bill_date = models.DateField()
    
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    blouse_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    extra_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True)
    extra_charges_type = models.CharField(max_length=10, default='add', choices=[('add', 'Add'), ('cut', 'Cut')], blank=True)
    extra_charges_reason = models.TextField(default='', blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    sgst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=2.50)
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cgst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=2.50)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    round_off = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_in_words = models.CharField(max_length=255, blank=True)
    is_challan = models.BooleanField(default=False)
    
    note_type = models.CharField(max_length=10, blank=True, choices=[('credit', 'Credit Note'), ('debit', 'Debit Note')], default="")
    note_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True, null=True)
    bank_name = models.CharField(max_length=150, blank=True, default="")
    check_no = models.CharField(max_length=50, blank=True, default="")
    check_date = models.DateField(blank=True, null=True)
    tds = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def display_customer_name(self):
        return self.customer_name or (self.customer.name if self.customer else "")

    @property
    def display_customer_address(self):
        return self.customer_address or (self.customer.address if self.customer else "")

    @property
    def display_customer_gst_number(self):
        return self.customer_gst_number or (self.customer.gst_number if self.customer else "")

    def __str__(self):
        return f"Invoice {self.bill_number} - {self.display_customer_name}"


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    p_ch_no = models.CharField(max_length=50, blank=True, null=True)
    lot_no = models.CharField(max_length=50, blank=True, null=True)
    design = models.CharField(max_length=100, blank=True, null=True)
    meter = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    t_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    p_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    s_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    qty = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def __str__(self):
        return f"Item in {self.invoice.bill_number} - Design {self.design}"


class DashboardItem(models.Model):
    customer_name = models.CharField(max_length=150)
    date = models.DateField()
    design = models.CharField(max_length=100, blank=True, default="")
    qty = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    meter = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, default='Pending', choices=[('Pending', 'Pending'), ('Done', 'Done')])
    
    # New metadata fields (saved to database only, not displayed in main table)
    p_ch_no = models.CharField(max_length=50, blank=True, default="")
    lot_no = models.CharField(max_length=50, blank=True, default="")
    gst_number = models.CharField(max_length=15, blank=True, default="")
    billing_address = models.TextField(blank=True, default="")
    hsn_code = models.CharField(max_length=50, blank=True, default="")
    broker = models.CharField(max_length=100, blank=True, default="")
    products_json = models.TextField(default="[]", blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f"Dashboard: {self.customer_name} - {self.design}"
