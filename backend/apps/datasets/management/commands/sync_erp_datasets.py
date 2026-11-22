from django.core.management.base import BaseCommand
from apps.datasets.services import sync_erp_tables_as_datasets


class Command(BaseCommand):
    help = "Discovers active ERP tables and synchronizes them as Datasets for the BI engine and Superset."

    def handle(self, *args, **options):
        self.stdout.write("Discovering ERP tables...")
        datasets = sync_erp_tables_as_datasets()
        self.stdout.write(self.style.SUCCESS(f"Successfully registered/synchronized {len(datasets)} ERP datasets:"))
        for ds in datasets:
            self.stdout.write(f"  - {ds.name} (table: {ds.table_name}, {ds.row_count} rows, {ds.column_count} cols)")
