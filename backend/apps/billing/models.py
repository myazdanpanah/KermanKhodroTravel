"""
Billing domain for Kerman Khodro Travel.

Implements the schema of the "KKTCOIG WEB REPLICATION SPECIFICATION"
(docs/kktcoig-spec sections 3.1 - 3.13). Amounts are integers in Rial,
dates are stored Gregorian and rendered Jalali, and every generated
document is kept twice (DB BLOB + disk file).
"""

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models


class Payer(models.Model):
    """Companies / customers (spec 3.2). Code is the natural key (1-5 digits)."""

    CUSTOMER_TYPES = [
        ("legal", "حقوقی"),
        ("person", "حقیقی"),
    ]

    code = models.CharField(
        max_length=5,
        primary_key=True,
        verbose_name="کد",
        validators=[RegexValidator(r"^\d{1,5}$", "کد شرکت باید ۱ تا ۵ رقم باشد.")],
    )
    name = models.CharField(max_length=100, verbose_name="نام")
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="شرکت مادر",
    )
    national_id = models.CharField(max_length=20, blank=True, default="", verbose_name="شناسه ملی")
    economic_code = models.CharField(max_length=20, blank=True, default="", verbose_name="کد اقتصادی")
    registration_number = models.CharField(
        max_length=20, blank=True, default="", verbose_name="شماره ثبت"
    )
    address = models.TextField(blank=True, default="", verbose_name="آدرس")
    postal_code = models.CharField(max_length=20, blank=True, default="", verbose_name="کد پستی")
    phone = models.CharField(max_length=20, blank=True, default="", verbose_name="تلفن")
    mobile = models.CharField(max_length=20, blank=True, default="", verbose_name="موبایل")
    email = models.CharField(max_length=100, blank=True, default="", verbose_name="ایمیل")
    customer_type = models.CharField(
        max_length=10,
        choices=CUSTOMER_TYPES,
        default="legal",
        verbose_name="نوع مشتری",
    )

    class Meta:
        verbose_name = "مشتری / شرکت"
        verbose_name_plural = "مشتریان / شرکت‌ها"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.parent_id and self.parent_id == self.code:
            # Spec 5.6: setting a company as its own parent is silently nulled.
            self.parent_id = None
        if not (self.code or "").isdigit() or len(self.code) > 5:
            raise ValidationError({"code": "کد شرکت باید ۱ تا ۵ رقم باشد."})

    def save(self, *args, **kwargs):
        if self.parent_id and self.parent_id == self.code:
            self.parent_id = None
        super().save(*args, **kwargs)


class Invoice(models.Model):
    """Flat invoice row produced per generated service file (spec 3.3)."""

    letter_number = models.CharField(max_length=50, verbose_name="شماره نامه")
    payer = models.CharField(max_length=100, verbose_name="شرکت")
    payer_code = models.CharField(max_length=5, verbose_name="کد شرکت")
    invoice_type = models.CharField(max_length=50, verbose_name="نوع خدمت")
    amount = models.BigIntegerField(verbose_name="مبلغ (ریال)")
    issue_date = models.DateField(verbose_name="تاریخ صدور")
    file_path = models.CharField(max_length=500, blank=True, default="", verbose_name="مسیر فایل")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "صورتحساب"
        verbose_name_plural = "صورتحساب‌ها"
        ordering = ["-issue_date", "-id"]
        indexes = [
            models.Index(fields=["payer_code"], name="idx_invoices_payer_code"),
            models.Index(fields=["letter_number"], name="idx_invoices_letter_number"),
            models.Index(fields=["issue_date"], name="idx_invoices_issue_date"),
        ]

    def __str__(self):
        return f"{self.letter_number} - {self.payer}"


class Payment(models.Model):
    """Received payment from a payer (spec 3.4)."""

    payment_code = models.CharField(max_length=20, blank=True, default="", verbose_name="کد پرداخت")
    payer_code = models.CharField(max_length=5, verbose_name="کد شرکت")
    payer_name = models.CharField(max_length=100, verbose_name="شرکت")
    payment_date = models.DateField(verbose_name="تاریخ پرداخت")
    amount = models.BigIntegerField(verbose_name="مبلغ (ریال)")
    tracking_number = models.CharField(
        max_length=50, blank=True, default="", verbose_name="شماره پیگیری"
    )
    description = models.CharField(max_length=500, blank=True, default="", verbose_name="توضیحات")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "پرداخت"
        verbose_name_plural = "پرداخت‌ها"
        ordering = ["-payment_date", "-id"]
        indexes = [models.Index(fields=["payer_code"], name="idx_payments_payer_code")]

    def __str__(self):
        return f"{self.payer_name} - {self.amount}"


class ManualDebt(models.Model):
    """Manually registered debt of a payer (spec 3.5)."""

    payer_code = models.CharField(max_length=5, verbose_name="کد شرکت")
    description = models.CharField(max_length=200, verbose_name="شرح")
    amount = models.BigIntegerField(verbose_name="مبلغ (ریال)")
    date = models.DateField(verbose_name="تاریخ")
    notes = models.CharField(max_length=500, blank=True, default="", verbose_name="یادداشت")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "بدهی دستی"
        verbose_name_plural = "بدهی‌های دستی"
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.payer_code} - {self.description}"


class Credit(models.Model):
    """Credit note in favour of the payer (spec 3.6)."""

    payer_code = models.CharField(max_length=5, verbose_name="کد شرکت")
    amount = models.BigIntegerField(verbose_name="مبلغ (ریال)")
    credit_date = models.DateField(verbose_name="تاریخ اعتبار")
    description = models.CharField(max_length=200, blank=True, default="", verbose_name="شرح")
    invoice_number = models.CharField(
        max_length=50, blank=True, default="", verbose_name="شماره صورتحساب"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "اعتبار"
        verbose_name_plural = "اعتبارها"
        ordering = ["-credit_date", "-id"]

    def __str__(self):
        return f"{self.payer_code} - {self.amount}"


class LetterSequence(models.Model):
    """Last used letter number per payer per Jalali year (spec 3.7)."""

    payer_code = models.CharField(max_length=5, verbose_name="کد شرکت")
    year = models.CharField(max_length=2, verbose_name="سال (دو رقم شمسی)")
    last_number = models.IntegerField(default=0, verbose_name="آخرین شماره")

    class Meta:
        verbose_name = "شمارنده نامه"
        verbose_name_plural = "شمارنده‌های نامه"
        constraints = [
            models.UniqueConstraint(fields=["payer_code", "year"], name="uniq_letter_sequence"),
        ]

    def __str__(self):
        return f"{self.payer_code}/{self.year}: {self.last_number}"


class AvailableLetterNumber(models.Model):
    """Recycled (deleted-invoice) letter numbers (spec 3.8)."""

    payer_code = models.CharField(max_length=5, verbose_name="کد شرکت")
    year = models.CharField(max_length=2, verbose_name="سال (دو رقم شمسی)")
    number = models.IntegerField(verbose_name="شماره آزاد")

    class Meta:
        verbose_name = "شماره آزاد نامه"
        verbose_name_plural = "شماره‌های آزاد نامه"
        constraints = [
            models.UniqueConstraint(
                fields=["payer_code", "year", "number"], name="uniq_available_letter_number"
            ),
        ]
        ordering = ["number"]

    def __str__(self):
        return f"{self.payer_code}/{self.year}: {self.number}"


class CompanySettings(models.Model):
    """Singleton: letterhead of the issuing company (spec 3.9)."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    company_name = models.CharField(max_length=200, blank=True, default="", verbose_name="نام شرکت")
    national_id = models.CharField(max_length=20, blank=True, default="", verbose_name="شناسه ملی")
    economic_code = models.CharField(max_length=20, blank=True, default="", verbose_name="کد اقتصادی")
    registration_number = models.CharField(
        max_length=20, blank=True, default="", verbose_name="شماره ثبت"
    )
    address = models.TextField(blank=True, default="", verbose_name="آدرس")
    postal_code = models.CharField(max_length=20, blank=True, default="", verbose_name="کد پستی")
    phone = models.CharField(max_length=20, blank=True, default="", verbose_name="تلفن")
    bank_name1 = models.CharField(max_length=100, blank=True, default="", verbose_name="بانک ۱")
    account_number1 = models.CharField(
        max_length=50, blank=True, default="", verbose_name="شماره حساب ۱"
    )
    shaba_number1 = models.CharField(
        max_length=50, blank=True, default="", verbose_name="شبا ۱"
    )
    bank_name2 = models.CharField(max_length=100, blank=True, default="", verbose_name="بانک ۲")
    account_number2 = models.CharField(
        max_length=50, blank=True, default="", verbose_name="شماره حساب ۲"
    )
    shaba_number2 = models.CharField(
        max_length=50, blank=True, default="", verbose_name="شبا ۲"
    )
    word_template_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="قالب Word اعلامیه بدهی (اصلی)",
        help_text="فایل .docx با placeholderهای {{ }} که به‌جای قالب داخلی استفاده می‌شود.",
    )
    word_template_subsidiary_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="قالب Word اعلامیه بدهی (شرکت زیرمجموعه)",
    )
    word_template_credit_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="قالب Word اعلامیه بستانکاری",
    )
    legal_note = models.TextField(
        blank=True,
        default="",
        verbose_name="متن پانویس قانونی",
        help_text="در انتهای هر سه اعلامیه چاپ می‌شود.",
    )
    logo_path = models.CharField(max_length=500, blank=True, default="", verbose_name="لوگو")
    signature_path = models.CharField(max_length=500, blank=True, default="", verbose_name="امضا")
    stamp_path = models.CharField(max_length=500, blank=True, default="", verbose_name="مهر")
    manager_name = models.CharField(max_length=100, blank=True, default="", verbose_name="نام مدیر")
    manager_position = models.CharField(
        max_length=100, blank=True, default="", verbose_name="سمت مدیر"
    )
    approved_output_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="مسیر ذخیره فایل‌های تأییدشده",
        help_text="اگر خالی باشد از MEDIA_ROOT/approved استفاده می‌شود.",
    )

    class Meta:
        verbose_name = "تنظیمات شرکت"
        verbose_name_plural = "تنظیمات شرکت"

    def save(self, *args, **kwargs):
        self.id = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.company_name or "تنظیمات شرکت"


class ApprovalRequest(models.Model):
    """Invoice issuance request flowing through approval (spec 3.10)."""

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "در انتظار تأیید"),
        (STATUS_APPROVED, "تأیید شده"),
        (STATUS_REJECTED, "رد شده"),
    ]

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="billing_requests",
        verbose_name="درخواست‌دهنده",
    )
    requester_name = models.CharField(max_length=50, verbose_name="نام درخواست‌دهنده")
    payer_code = models.CharField(max_length=5, verbose_name="کد شرکت")
    payer_name = models.CharField(max_length=100, verbose_name="نام شرکت")
    service_type = models.CharField(max_length=50, verbose_name="نوع خدمت")
    letter_number = models.CharField(max_length=50, verbose_name="شماره نامه")
    letter_date = models.CharField(max_length=20, verbose_name="تاریخ نامه (شمسی)")
    start_day = models.IntegerField(verbose_name="از روز")
    end_day = models.IntegerField(verbose_name="تا روز")
    month = models.CharField(max_length=20, verbose_name="ماه")
    year = models.IntegerField(verbose_name="سال")
    period_range = models.CharField(max_length=100, verbose_name="بازه")
    service_data = models.JSONField(default=list, blank=True, verbose_name="داده خدمات")
    flight_data = models.JSONField(default=list, blank=True, verbose_name="داده پرواز")
    hotel_data = models.JSONField(default=list, blank=True, verbose_name="داده هتل")
    reserved_numbers = models.JSONField(default=list, blank=True, verbose_name="شماره‌های رزرو")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, verbose_name="وضعیت"
    )
    rejection_reason = models.CharField(
        max_length=500, blank=True, default="", verbose_name="دلیل رد"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="billing_approvals",
        verbose_name="تأییدکننده",
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان تأیید")
    generation_completed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="زمان پایان تولید فایل"
    )
    generation_error = models.TextField(blank=True, default="", verbose_name="خطای تولید")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "درخواست صدور"
        verbose_name_plural = "درخواست‌های صدور"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="idx_approval_status"),
            models.Index(fields=["requester"], name="idx_approval_requester"),
        ]

    def __str__(self):
        return f"{self.letter_number} {self.payer_name} ({self.get_status_display()})"

    @property
    def total_debt(self):
        return sum(int(r.get("بدهکار") or 0) for r in self._rows())

    @property
    def total_credit(self):
        return sum(int(r.get("بستانکار") or 0) for r in self._rows())

    def _rows(self):
        return list(self.flight_data or []) + list(self.hotel_data or []) + list(self.service_data or [])


class FinalFile(models.Model):
    """Generated document stored twice: DB BLOB + disk (spec 3.11)."""

    request = models.ForeignKey(
        ApprovalRequest,
        on_delete=models.CASCADE,
        related_name="files",
        verbose_name="درخواست",
    )
    letter_number = models.CharField(max_length=50, verbose_name="شماره نامه")
    service_type = models.CharField(max_length=50, verbose_name="نوع خدمت")
    file_name = models.CharField(max_length=200, verbose_name="نام فایل")
    file_path = models.CharField(max_length=500, blank=True, default="", verbose_name="مسیر")
    file_data = models.BinaryField(null=True, blank=True, editable=False, verbose_name="محتوای فایل")
    created_at = models.DateTimeField(auto_now_add=True)
    last_accessed = models.DateTimeField(null=True, blank=True, verbose_name="آخرین دسترسی")
    is_deleted_from_disk = models.BooleanField(default=False, verbose_name="از دیسک حذف شده")
    purged_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان پاک‌سازی",
        help_text="پس از ۲۴ ساعت محتوا پاک می‌شود و هنگام دانلود دوباره تولید می‌گردد.",
    )

    class Meta:
        verbose_name = "فایل نهایی"
        verbose_name_plural = "فایل‌های نهایی"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["letter_number"], name="idx_final_files_letter"),
            models.Index(fields=["request"], name="idx_final_files_request"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["request", "service_type", "file_name"],
                name="uniq_final_file_per_request",
            )
        ]

    def __str__(self):
        return self.file_name


class ServiceCategory(models.Model):
    """Billable service categories (spec 3.12)."""

    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="دسته مادر",
    )
    name = models.CharField(max_length=100, verbose_name="نام")
    code = models.CharField(max_length=20, unique=True, verbose_name="کد")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    display_order = models.IntegerField(default=0, verbose_name="ترتیب نمایش")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "دسته خدمت"
        verbose_name_plural = "دسته‌های خدمت"
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name


class InvoiceTemplate(models.Model):
    """Versioned HTML/CSS letter template; exactly one is active (spec 3.13)."""

    name = models.CharField(max_length=100, verbose_name="نام")
    description = models.CharField(max_length=500, blank=True, default="", verbose_name="توضیح")
    html_content = models.TextField(blank=True, default="", verbose_name="HTML")
    css_content = models.TextField(blank=True, default="", verbose_name="CSS")
    settings_json = models.JSONField(default=dict, blank=True, verbose_name="تنظیمات صفحه")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoice_templates",
        verbose_name="سازنده",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "قالب صورتحساب"
        verbose_name_plural = "قالب‌های صورتحساب"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}{' (فعال)' if self.is_active else ''}"

    def save(self, *args, **kwargs):
        # Spec 3.13: exactly ONE active template at any time.
        if self.is_active:
            InvoiceTemplate.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)
