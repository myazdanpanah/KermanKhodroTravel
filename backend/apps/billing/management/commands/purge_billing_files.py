"""Release generated files past the retention window (spec §7)."""

from django.core.management.base import BaseCommand

from apps.billing.services.files import RETENTION_HOURS, purge_expired_files


class Command(BaseCommand):
    help = "Delete stored payloads of generated files older than the retention window."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=RETENTION_HOURS,
            help=f"Retention window in hours (default {RETENTION_HOURS}).",
        )

    def handle(self, *args, **options):
        purged = purge_expired_files(older_than_hours=options["hours"])
        self.stdout.write(self.style.SUCCESS(f"purged {purged} generated file(s)"))
