"""Idempotent seed for a fresh KKT installation (spec §3.1, §3.12, §3.13)."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Company
from apps.billing.models import CompanySettings, InvoiceTemplate, ServiceCategory
from apps.billing.permissions import PERMISSION_FLAGS
from apps.billing.services.generation import DEFAULT_CSS, DEFAULT_HTML

SERVICE_CATEGORIES = [
    ("ویزا", "VISA", 1),
    ("اتوبوس", "BUS", 2),
    ("قطار", "TRAIN", 3),
    ("گشت", "TOUR", 4),
    ("تور", "PACKAGE", 5),
    ("CIP", "CIP", 6),
]

User = get_user_model()


class Command(BaseCommand):
    help = "Seed the KKT billing schema: admin user, service categories, default template."

    @transaction.atomic
    def handle(self, *args, **options):
        created = []

        admin, is_new = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@kermankhodro.local",
                "first_name": "Admin",
                "last_name": "User",
                "role": "admin",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if is_new or not admin.check_password("admin12345"):
            admin.set_password("admin12345")
        for flag in PERMISSION_FLAGS:
            setattr(admin, flag, True)
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()
        created.append("admin user")

        company = Company.objects.order_by("id").first()
        if company is None:
            company = Company.objects.create(
                name="سفرهای کرمان خودرو",
                description="آژانس مسافرتی کرمان خودرو",
                enabled_modules=["bi_dashboard", "finance", "crm"],
            )
            created.append("company")
        admin.company = company
        admin.save(update_fields=["company"])

        for name, code, order in SERVICE_CATEGORIES:
            _, made = ServiceCategory.objects.get_or_create(
                code=code, defaults={"name": name, "display_order": order}
            )
            if made:
                created.append(f"service category {code}")

        if not InvoiceTemplate.objects.filter(is_active=True).exists():
            InvoiceTemplate.objects.create(
                name="قالب پیش‌فرض",
                description="قالب رسمی صورتحساب (قابل ویرایش در تنظیمات)",
                html_content=DEFAULT_HTML,
                css_content=DEFAULT_CSS,
                settings_json={
                    "page_size": "A4",
                    "font_family": "B Nazanin, Vazirmatn, Tahoma, sans-serif",
                    "font_size": "12pt",
                    "show_header": True,
                    "show_footer": True,
                    "show_logo": True,
                    "show_signature": True,
                    "show_stamp": True,
                },
                is_active=True,
                created_by=admin,
            )
            created.append("default invoice template")

        settings_obj = CompanySettings.load()
        if not settings_obj.company_name:
            settings_obj.company_name = company.name
            settings_obj.save(update_fields=["company_name"])
            created.append("company settings")

        self.stdout.write(self.style.SUCCESS("Seed complete: " + (", ".join(created) or "nothing to do")))
