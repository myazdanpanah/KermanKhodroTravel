from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Company, Division, Team, CustomRole, MODULE_CHOICES, ALL_MODULE_IDS

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True, default=None)
    division_name = serializers.CharField(source='division.name', read_only=True, default=None)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    reports_to_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    accessible_modules = serializers.SerializerMethodField()
    # Billing permission flags (KKTCOIG spec §6.1) so the UI can hide actions.
    permissions = serializers.SerializerMethodField()
    # Raw stored flags (not role-expanded) for the per-user permission editor.
    permission_flags = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "department", "is_staff", "avatar", "avatar_url",
            "company", "company_name",
            "division", "division_name",
            "team", "team_name",
            "reports_to", "reports_to_name",
            "accessible_modules",
            "permissions",
            "permission_flags",
            # Writable per-feature flags (spec §6.1) for the user editor.
            "can_view", "can_pay", "can_issue", "can_manage_users",
            "can_manage_settings", "can_delete_history", "can_delete_payment",
            "can_export", "can_manage_companies", "can_submit", "can_approve",
            "can_edit_template",
        ]
        read_only_fields = ["id"]

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        try:
            return obj.avatar.url
        except ValueError:
            return None

    def get_reports_to_name(self, obj):
        if obj.reports_to:
            return f"{obj.reports_to.first_name} {obj.reports_to.last_name}".strip() or obj.reports_to.username
        return None

    def get_permissions(self, obj):
        from apps.billing.permissions import permissions_payload

        return permissions_payload(obj)

    def get_permission_flags(self, obj):
        from apps.billing.permissions import PERMISSION_FLAGS

        return {flag: bool(getattr(obj, flag, False)) for flag in PERMISSION_FLAGS}

    def get_accessible_modules(self, obj):
        """Return the list of module slugs this user can access based on company entitlement and user role/permissions."""
        is_sysadmin = bool(getattr(obj, "is_superuser", False) or obj.role == "admin")
        if is_sysadmin:
            return ALL_MODULE_IDS

        if not obj.company:
            raw_modules = [m for m in ("bi_dashboard", "finance", "crm", "office") if m in ALL_MODULE_IDS]
        else:
            raw_modules = list(obj.company.enabled_modules or [])

        # System Settings and DB Manager are strictly for System Administrator
        enabled = [m for m in raw_modules if m not in ("settings", "db_manager")]

        # CEO has access to all company-enabled business modules
        if obj.role == "ceo":
            return enabled

        # Per-module role and permission gating for other staff/users
        filtered = []
        for m in enabled:
            if m in ("finance", "billing"):
                if obj.role == "finance" or getattr(obj, "can_view", False):
                    filtered.append(m)
            elif m == "crm":
                if obj.role == "sales" or getattr(obj, "department", "") == "sales" or getattr(obj, "can_view_crm", False):
                    filtered.append(m)
            elif m in ("bi_dashboard", "bi"):
                # BI is accessible to management, finance, sales, or users with view permission
                if obj.role in ("finance", "sales") or getattr(obj, "can_view", False):
                    filtered.append(m)
            else:
                # Other modules (e.g., office, orbit) are accessible to all company members when enabled
                filtered.append(m)

        return filtered


class CompanySerializer(serializers.ModelSerializer):
    division_count = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id", "name", "description", "is_active",
            "enabled_modules", "logo", "logo_url",
            "primary_color", "accent_color",
            "division_count", "employee_count", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_logo_url(self, obj):
        return obj.logo.url if obj.logo else None

    def get_division_count(self, obj):
        return obj.divisions.count()

    def get_employee_count(self, obj):
        return obj.employees.count()


class CompanyModulesSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the modules-only update endpoint."""
    all_modules = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = ["id", "enabled_modules", "all_modules"]
        read_only_fields = ["id"]

    def get_all_modules(self, obj):
        return [{"id": m[0], "label": m[1]} for m in MODULE_CHOICES]


class CompanyBrandingSerializer(serializers.ModelSerializer):
    """Company logo + brand colors — the single source for system-wide branding."""
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = ["id", "name", "logo", "logo_url", "primary_color", "accent_color"]
        extra_kwargs = {"logo": {"required": False}}

    def get_logo_url(self, obj):
        return obj.logo.url if obj.logo else None

    def validate_primary_color(self, value):
        return self._validate_hex(value)

    def validate_accent_color(self, value):
        return self._validate_hex(value)

    @staticmethod
    def _validate_hex(value):
        value = (value or "").strip()
        if len(value) != 7 or not value.startswith("#"):
            raise serializers.ValidationError("Use a #RRGGBB hex color.")
        try:
            int(value[1:], 16)
        except ValueError:
            raise serializers.ValidationError("Use a #RRGGBB hex color.")
        return value.upper()


class DivisionSerializer(serializers.ModelSerializer):
    manager_name = serializers.SerializerMethodField()
    team_count = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = Division
        fields = [
            "id", "company", "name", "description",
            "manager", "manager_name", "parent",
            "is_active", "team_count", "employee_count", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_manager_name(self, obj):
        if obj.manager:
            return f"{obj.manager.first_name} {obj.manager.last_name}".strip() or obj.manager.username
        return None

    def get_team_count(self, obj):
        return obj.teams.count()

    def get_employee_count(self, obj):
        return obj.employees.count()


class TeamSerializer(serializers.ModelSerializer):
    manager_name = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    division_name = serializers.CharField(source='division.name', read_only=True)
    company_name = serializers.CharField(source='division.company.name', read_only=True)

    class Meta:
        model = Team
        fields = [
            "id", "division", "name", "description",
            "manager", "manager_name",
            "is_active", "member_count",
            "division_name", "company_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_manager_name(self, obj):
        if obj.manager:
            return f"{obj.manager.first_name} {obj.manager.last_name}".strip() or obj.manager.username
        return None

    def get_member_count(self, obj):
        return obj.members.count()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name", "role", "department", "company", "division", "team", "reports_to"]

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class CustomRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomRole
        fields = ['id', 'value', 'label', 'color', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
