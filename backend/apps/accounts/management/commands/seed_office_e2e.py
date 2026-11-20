"""Idempotent fixture for the browser E2E secretariat flow.

Creates (or resets) a dedicated company, a secretary who is a secretariat
member without manager rights, and an outsider who is not a member.
It never touches data outside this company, and resets the letter sequence
so the test can assert the first issued number.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import Company
from apps.office.models import (
    Correspondence,
    Secretariat,
    SecretariatMember,
    SecretariatNumberSequence,
)

User = get_user_model()

COMPANY_NAME = "E2E Office Co"
PASSWORD = "e2e-pass-1234"
USERS = (
    ("e2e_secretary", "sales", "E2E Secretary"),
    ("e2e_outsider", "finance", "E2E Outsider"),
)


class Command(BaseCommand):
    help = "Create or reset the company, users and secretariat used by the Office browser E2E test"

    def handle(self, *args, **options):
        company, _ = Company.objects.get_or_create(name=COMPANY_NAME)
        company.enable_module("office")
        company.save()

        secretariat, _ = Secretariat.objects.get_or_create(
            company=company, code="E2E", defaults={"name": "E2E Secretariat"},
        )
        secretariat.name = "E2E Secretariat"
        secretariat.is_active = True
        secretariat.save()

        users = {}
        for username, role, name in USERS:
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={"company": company, "role": role, "first_name": name, "email": f"{username}@e2e.local"},
            )
            user.company = company
            user.role = role
            user.first_name = name
            user.last_name = ""
            user.is_staff = False
            user.is_superuser = False
            user.is_active = True
            user.set_password(PASSWORD)
            user.save()
            users[username] = user

        Correspondence.objects.filter(company=company).delete()
        SecretariatNumberSequence.objects.filter(company=company).delete()
        SecretariatMember.objects.filter(secretariat=secretariat).delete()
        SecretariatMember.objects.create(
            secretariat=secretariat, user=users["e2e_secretary"], can_register=True,
        )

        self.stdout.write(self.style.SUCCESS(
            f"E2E fixture ready: company={COMPANY_NAME} users={[u for u, _, _ in USERS]} secretariat=E2E",
        ))
