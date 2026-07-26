"""
SSO & Identity — Migration 0001: initial models.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SSOProvider",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("delete_reason", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=200)),
                ("slug", models.SlugField(unique=True)),
                ("protocol", models.CharField(choices=[("saml", "SAML 2.0"), ("oidc", "OpenID Connect")], default="oidc", max_length=10)),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive"), ("pending", "Pending Setup")], default="pending", max_length=20)),
                ("description", models.TextField(blank=True, default="")),
                ("saml_entity_id", models.CharField(blank=True, default="", max_length=500)),
                ("saml_sso_url", models.URLField(blank=True, default="", max_length=500)),
                ("saml_slo_url", models.URLField(blank=True, default="", max_length=500)),
                ("saml_certificate", models.TextField(blank=True, default="")),
                ("saml_metadata_url", models.URLField(blank=True, default="", max_length=500)),
                ("saml_name_id_format", models.CharField(blank=True, default="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", max_length=200)),
                ("oidc_client_id", models.CharField(blank=True, default="", max_length=500)),
                ("oidc_client_secret", models.CharField(blank=True, default="", max_length=500)),
                ("oidc_discovery_url", models.URLField(blank=True, default="", max_length=500)),
                ("oidc_authorization_url", models.URLField(blank=True, default="", max_length=500)),
                ("oidc_token_url", models.URLField(blank=True, default="", max_length=500)),
                ("oidc_userinfo_url", models.URLField(blank=True, default="", max_length=500)),
                ("oidc_jwks_url", models.URLField(blank=True, default="", max_length=500)),
                ("oidc_scopes", models.JSONField(blank=True, default=list)),
                ("jit_provisioning", models.BooleanField(default=True)),
                ("default_role", models.CharField(blank=True, default="updater", max_length=50)),
                ("default_modules", models.JSONField(blank=True, default=list)),
                ("attribute_mapping", models.JSONField(blank=True, default=dict)),
                ("allowed_domains", models.JSONField(blank=True, default=list)),
                ("logo_url", models.URLField(blank=True, default="", max_length=500)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sso_ssoprovider_set", to="accounts.company")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_provider_created", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_provider_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["name"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="SSOUserMapping",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("delete_reason", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("external_id", models.CharField(max_length=500)),
                ("external_email", models.EmailField(blank=True, default="", max_length=254)),
                ("last_login_at", models.DateTimeField(blank=True, null=True)),
                ("raw_claims", models.JSONField(blank=True, default=dict)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sso_ssousermapping_set", to="accounts.company")),
                ("provider", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_mappings", to="sso.ssoprovider")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sso_mappings", to=settings.AUTH_USER_MODEL)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_mapping_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_mapping_updated", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_mapping_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="SSOLoginAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("delete_reason", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("status", models.CharField(choices=[("success", "Success"), ("failed", "Failed"), ("error", "Error")], max_length=20)),
                ("external_email", models.EmailField(blank=True, default="", max_length=254)),
                ("external_id", models.CharField(blank=True, default="", max_length=500)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True, default="")),
                ("error_message", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sso_ssologinattempt_set", to="accounts.company")),
                ("provider", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="login_attempts", to="sso.ssoprovider")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_login_attempts", to=settings.AUTH_USER_MODEL)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_attempt_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_attempt_updated", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_attempt_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="SSORefreshToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("delete_reason", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("token_hash", models.CharField(max_length=256)),
                ("external_refresh_token", models.TextField(blank=True, default="")),
                ("expires_at", models.DateTimeField()),
                ("revoked", models.BooleanField(default=False)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sso_ssorefreshtoken_set", to="accounts.company")),
                ("provider", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="refresh_tokens", to="sso.ssoprovider")),
                ("replaced_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="sso.ssorefreshtoken")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sso_refresh_tokens", to=settings.AUTH_USER_MODEL)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_token_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_token_updated", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sso_token_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="ssousermapping",
            constraint=models.UniqueConstraint(fields=("provider", "external_id"), name="unique_sso_mapping"),
        ),
        migrations.AddIndex(
            model_name="ssologinattempt",
            index=models.Index(fields=["-created_at"], name="sso_attempt_created_idx"),
        ),
    ]
