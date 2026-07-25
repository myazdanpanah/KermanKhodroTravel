"""
Management command to clean up old rate limit logs.

Usage:
    python manage.py cleanup_rate_limit_logs --days=90
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.rate_limiting.models import RateLimitLog


class Command(BaseCommand):
    help = "Remove rate limit logs older than N days (default: 90)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Number of days to retain logs (default: 90)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many logs would be deleted without actually deleting",
        )

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]

        cutoff = timezone.now() - timedelta(days=days)
        old_logs = RateLimitLog.objects.filter(timestamp__lt=cutoff)
        count = old_logs.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: Would delete {count} logs older than {days} days "
                    f"(before {cutoff.strftime('%Y-%m-%d %H:%M')})"
                )
            )
            return

        old_logs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully deleted {count} logs older than {days} days"
            )
        )
