from django.db import models
from django.conf import settings

class Company(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='companies')
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

    company_name = models.CharField(max_length=200, blank=True, default="")
    gst_number = models.CharField(max_length=50, blank=True, default="")
    pan_number = models.CharField(max_length=50, blank=True, default="")
    plan_expiry_date = models.DateField(blank=True, null=True)
    license_key = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name_plural = "Company Settings"

    def __str__(self):
        return self.company_name or ""


class Customer(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='customers')
    name = models.CharField(max_length=150)
    address = models.TextField(blank=True, default="")
    gst_number = models.CharField(max_length=15, blank=True, default="")

    def __str__(self):
        return self.name


class Invoice(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='invoices')
    bill_number = models.CharField(max_length=50, blank=True, null=True)
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

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'bill_number'],
                condition=models.Q(bill_number__isnull=False) & ~models.Q(bill_number=''),
                name='unique_user_bill_number'
            )
        ]

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
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='dashboard_items')
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
