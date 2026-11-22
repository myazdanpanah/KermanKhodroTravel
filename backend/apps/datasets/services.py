"""
Service to discover, register, and sync ERP database tables as BI Datasets,
and connect them to Apache Superset.
"""
import logging
from django.db import connection
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import Dataset

logger = logging.getLogger(__name__)

ERP_TABLES_META = [
    {
        "table_name": "billing_invoice",
        "name": "صورت‌حساب‌ها (Invoices)",
        "description": "صورت‌حساب‌های صادره سازمان، مبالغ ناخالص، مالیات، ارزش افزوده، وضعیت پرداخت و تاریخ‌های سررسید",
        "allowed_roles": ["ceo", "admin", "finance"],
    },
    {
        "table_name": "billing_invoiceitem",
        "name": "اقلام و خدمات صورت‌حساب‌ها (Invoice Items)",
        "description": "ریز مشخصات خدمات صورت‌حساب‌ها شامل مقاصد پرواز، هتل‌ها، نام مسافران، شماره بلیط، تاریخ‌ها و مبالغ برای تحلیل‌های پرتکرار",
        "allowed_roles": ["ceo", "admin", "finance", "sales"],
    },
    {
        "table_name": "billing_payment",
        "name": "دریافت‌ها و پرداخت‌ها (Payments)",
        "description": "ریز دریافت‌ها و تسویه‌حساب‌های مالی، روش‌های پرداخت، تاریخ جلالی و کدهای پیگیری بانکی",
        "allowed_roles": ["ceo", "admin", "finance"],
    },
    {
        "table_name": "billing_payer",
        "name": "طرف‌های حساب و مشتریان (Payers)",
        "description": "مشخصات اشخاص و شرکت‌های طرف حساب، شناسه ملی، کد اقتصادی، وضعیت فعال‌بودن و مانده حساب",
        "allowed_roles": ["ceo", "admin", "finance", "sales"],
    },
    {
        "table_name": "billing_manualdebt",
        "name": "بدهی‌های دستی و متفرقه (Manual Debts)",
        "description": "ثبت مطالبات و بدهی‌های متفرقه ثبت شده در سیستم مالی",
        "allowed_roles": ["ceo", "admin", "finance"],
    },
    {
        "table_name": "billing_credit",
        "name": "اعلامیه‌های بستانکاری (Credits)",
        "description": "اعلامیه‌های بستانکاری و اعتبارات تخصیص‌یافته به طرف‌های حساب",
        "allowed_roles": ["ceo", "admin", "finance"],
    },
    {
        "table_name": "office_contract",
        "name": "قراردادهای اداری و تجاری (Contracts)",
        "description": "قراردادهای حقوقی و تجاری منعقد شده، مبالغ، طرفین قرارداد و وضعیت اجرای تعهدات",
        "allowed_roles": ["ceo", "admin", "office", "finance"],
    },
    {
        "table_name": "office_correspondence",
        "name": "نامه‌ها و مکاتبات اداری (Correspondence)",
        "description": "دبیرخانه و نامه‌های وارده، صادره و داخلی، گردش کار و وضعیت بایگانی",
        "allowed_roles": ["ceo", "admin", "office"],
    },
    {
        "table_name": "crm_opportunity",
        "name": "فرصت‌های فروش (Opportunities)",
        "description": "فرصت‌های فروش تجاری، درآمدهای پیش‌بینی‌شده، ضریب موفقیت و مراحل قیف فروش",
        "allowed_roles": ["ceo", "admin", "sales"],
    },
    {
        "table_name": "crm_lead",
        "name": "سرنخ‌های بازاریابی (Leads)",
        "description": "سرنخ‌های ثبت‌شده، کانال‌های جذب مشتری، شرکت و وضعیت تبدیل",
        "allowed_roles": ["ceo", "admin", "sales"],
    },
    {
        "table_name": "crm_campaign",
        "name": "کمپین‌های بازاریابی (Campaigns)",
        "description": "کمپین‌های تبلیغاتی و بازاریابی، بودجه مصوب و هزینه‌های تحقق‌یافته",
        "allowed_roles": ["ceo", "admin", "sales"],
    },
]


def sync_erp_tables_as_datasets():
    """
    Inspects PostgreSQL schema for known ERP tables, creates or updates Dataset records,
    and attempts to register them into Superset.
    Returns: list of Dataset objects
    """
    User = get_user_model()
    owner = (
        User.objects.filter(is_superuser=True).first()
        or User.objects.filter(role="admin").first()
        or User.objects.first()
    )

    synced = []
    with connection.cursor() as cursor:
        for meta in ERP_TABLES_META:
            tbl = meta["table_name"]
            cursor.execute(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position",
                ["public", tbl],
            )
            rows = cursor.fetchall()
            if not rows:
                continue

            column_names = [r[0] for r in rows]
            column_types = {r[0]: r[1].upper() for r in rows}

            cursor.execute(f'SELECT COUNT(*) FROM "{tbl}"')
            row_count = cursor.fetchone()[0]

            dataset, created = Dataset.objects.get_or_create(
                table_name=tbl,
                defaults={
                    "name": meta["name"],
                    "description": meta["description"],
                    "status": "ready",
                    "row_count": row_count,
                    "column_count": len(column_names),
                    "column_names": column_names,
                    "column_types": column_types,
                    "allowed_roles": meta["allowed_roles"],
                    "owner": owner,
                },
            )
            if not created:
                dataset.name = meta["name"]
                dataset.description = meta["description"]
                dataset.status = "ready"
                dataset.row_count = row_count
                dataset.column_count = len(column_names)
                dataset.column_names = column_names
                dataset.column_types = column_types
                dataset.allowed_roles = meta["allowed_roles"]
                dataset.save()

            # Attempt Superset sync (best-effort)
            try:
                from .superset import superset_client

                db_id = superset_client.ensure_database_registered()
                superset_dataset_id = superset_client.register_dataset(
                    database_id=db_id or getattr(settings, "SUPERSET_DEFAULT_DATABASE_ID", 1),
                    table_name=tbl,
                )
                if superset_dataset_id:
                    dataset.superset_dataset_id = superset_dataset_id
                    dataset.save(update_fields=["superset_dataset_id"])
            except Exception as exc:
                logger.debug("Superset sync for table %s skipped or offline: %s", tbl, exc)

            synced.append(dataset)

    return synced
