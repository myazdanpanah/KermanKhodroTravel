"""
Management command to seed demo data for trading, manufacturing quality,
and inventory modules.

Usage:
    python manage.py seed_trading_data
"""

import datetime
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.accounts.models import Company
from apps.finance.models import Supplier, Customer

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo data for trading, manufacturing quality, and inventory modules."

    def handle(self, *args, **options):
        # Get or create company
        company, _ = Company.objects.get_or_create(
            name="Demo Trading Co",
            defaults={"code": "DTC", "enabled_modules": [
                "bi_dashboard", "finance", "manufacturing", "inventory",
                "purchasing", "sales", "workflow", "trading",
            ]},
        )
        self.stdout.write(f"Company: {company.name}")

        # Create a demo user for the company
        user, created = User.objects.get_or_create(
            username="trader",
            defaults={
                "company": company,
                "role": "ceo",
                "first_name": "Demo",
                "last_name": "Trader",
                "is_staff": True,
            },
        )
        if created:
            user.set_password("pass123")
            user.save()
            self.stdout.write(f"  ✓ Created user: trader / pass123")

        # Create supplier and customer
        supplier, _ = Supplier.objects.get_or_create(
            company=company, name="Shanghai Electronics Co",
            defaults={"supplier_type": "foreign", "national_id": "CN-2024-001"},
        )
        customer, _ = Customer.objects.get_or_create(
            company=company, name="Dubai Trading LLC",
            defaults={"customer_type": "international", "national_id": "AE-2024-001"},
        )

        # ─── Trading Chart of Accounts ────────────────────
        from apps.finance.models import AccountGroup, KolAccount

        # Create account groups if not exist
        g_assets, _ = AccountGroup.objects.get_or_create(company=company, code="1", defaults={"name": "دارایی‌ها"})
        g_liabilities, _ = AccountGroup.objects.get_or_create(company=company, code="2", defaults={"name": "بدهی‌ها"})
        g_revenue, _ = AccountGroup.objects.get_or_create(company=company, code="4", defaults={"name": "درآمدها"})
        g_expenses, _ = AccountGroup.objects.get_or_create(company=company, code="5", defaults={"name": "هزینه‌ها"})

        # Trading accounts used by PostingEngine
        KolAccount.objects.get_or_create(company=company, code="132", defaults={"group": g_assets, "name": "اسناد دریافتنی تجاری", "account_type": "asset", "normal_balance": "debit"})
        KolAccount.objects.get_or_create(company=company, code="232", defaults={"group": g_liabilities, "name": "اسناد پرداختنی تجاری", "account_type": "liability", "normal_balance": "credit"})
        KolAccount.objects.get_or_create(company=company, code="233", defaults={"group": g_liabilities, "name": "بدهی گمرکی", "account_type": "liability", "normal_balance": "credit"})
        KolAccount.objects.get_or_create(company=company, code="403", defaults={"group": g_revenue, "name": "درآمد صادرات", "account_type": "revenue", "normal_balance": "credit"})
        KolAccount.objects.get_or_create(company=company, code="512", defaults={"group": g_expenses, "name": "هزینه حمل و نقل", "account_type": "expense", "normal_balance": "debit"})

        self.stdout.write(self.style.SUCCESS(f"  ✓ Trading accounts: 132, 232, 233, 403, 512"))

        # ─── Trading Module ─────────────────────────────
        from apps.trading.models import ImportOrder, ExportOrder, Container, Shipment

        import_order, _ = ImportOrder.objects.get_or_create(
            company=company, order_number="IMP-00001",
            defaults={
                "supplier": supplier,
                "product_name": "LED Display Panels",
                "quantity": Decimal("500"),
                "unit_price_foreign": Decimal("120.50"),
                "foreign_currency": "USD",
                "exchange_rate": Decimal("42000"),
                "incoterm": "FOB",
                "port_of_loading": "Shanghai",
                "port_of_discharge": "Bandar Abbas",
                "status": "confirmed",
                "created_by": user,
            },
        )

        export_order, _ = ExportOrder.objects.get_or_create(
            company=company, order_number="EXP-00001",
            defaults={
                "customer": customer,
                "product_name": "Industrial Sensors",
                "quantity": Decimal("200"),
                "unit_price_foreign": Decimal("85.00"),
                "foreign_currency": "USD",
                "exchange_rate": Decimal("42000"),
                "incoterm": "CIF",
                "port_of_loading": "Bandar Abbas",
                "port_of_discharge": "Dubai",
                "status": "confirmed",
                "created_by": user,
            },
        )

        container, _ = Container.objects.get_or_create(
            container_number="MSCU1234567",
            defaults={
                "company": company,
                "container_type": "40ft",
                "status": "in_transit",
                "carrier": "Maersk Line",
                "vessel_name": "Maersk Seletar",
                "voyage_number": "VY-2026-0721",
                "import_order": import_order,
            },
        )

        Shipment.objects.get_or_create(
            company=company, shipment_number="SHP-00001",
            defaults={
                "shipment_type": "sea",
                "status": "in_transit",
                "origin": "Shanghai, China",
                "destination": "Bandar Abbas, Iran",
                "carrier": "Maersk Line",
                "import_order": import_order,
                "container": container,
                "freight_cost": Decimal("3500"),
                "insurance_cost": Decimal("500"),
                "cost_currency": "USD",
            },
        )

        self.stdout.write(self.style.SUCCESS(f"  ✓ Trading: 1 import order, 1 export order, 1 container, 1 shipment"))

        # ─── Manufacturing Quality ──────────────────────
        from apps.manufacturing.quality import QualityPlan, InspectionResult

        qp, _ = QualityPlan.objects.get_or_create(
            company=company, name="LED Panel Final Inspection",
            defaults={
                "inspection_type": "final",
                "product_name": "LED Display Panels",
                "is_active": True,
                "criteria": [
                    {"name": "Visual Inspection", "method": "visual", "tolerance": "No defects"},
                    {"name": "Pixel Test", "method": "automated", "tolerance": "0 dead pixels"},
                    {"name": "Brightness Test", "method": "measured", "tolerance": "≥500 nits"},
                ],
            },
        )

        InspectionResult.objects.get_or_create(
            company=company, quality_plan=qp,
            product_name="LED Display Panel - Batch 001",
            defaults={
                "quantity_inspected": Decimal("50"),
                "quantity_passed": Decimal("48"),
                "quantity_failed": Decimal("2"),
                "status": "passed",
                "notes": "2 panels failed brightness test",
                "inspected_by": user,
            },
        )

        self.stdout.write(self.style.SUCCESS(f"  ✓ Manufacturing: 1 quality plan, 1 inspection result"))

        # ─── Inventory ──────────────────────────────────
        from apps.inventory.models import Warehouse, StockLedger

        wh, _ = Warehouse.objects.get_or_create(
            company=company, code="WH-MAIN",
            defaults={"name": "Main Warehouse", "warehouse_type": "main"},
        )

        StockLedger.objects.get_or_create(
            company=company, product_code="LED-PNL-001", warehouse=wh,
            defaults={
                "product_name": "LED Display Panel",
                "quantity_on_hand": Decimal("450"),
                "quantity_reserved": Decimal("50"),
                "quantity_available": Decimal("400"),
                "unit_cost": Decimal("5061000"),
                "total_value": Decimal("2277450000"),
                "reorder_level": Decimal("100"),
                "reorder_quantity": Decimal("200"),
            },
        )

        self.stdout.write(self.style.SUCCESS(f"  ✓ Inventory: 1 warehouse, 1 stock ledger entry"))

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Demo data seeded for company '{company.name}' "
            f"(modules: {', '.join(company.enabled_modules)})"
        ))
