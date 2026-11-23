from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from django.contrib.auth import authenticate, get_user_model
from django.db import models
from .authentication import JWTAuthentication
from .serializers import (
    LoginSerializer, RegisterSerializer, UserSerializer,
    CompanySerializer, CompanyModulesSerializer, CompanyBrandingSerializer,
    DivisionSerializer, TeamSerializer, CustomRoleSerializer,
)
from .models import Company, CompanyFont, Division, Team, CustomRole, MODULE_CHOICES, ALL_MODULE_IDS

User = get_user_model()


def _is_admin_or_ceo(user):
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user.role in ("admin", "ceo") or user.is_staff or getattr(user, "is_superuser", False) or getattr(user, "can_manage_users", False)


def _is_system_admin(user):
    """True exclusively for the main system administrator (role 'admin' or superuser)."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user.role == "admin" or getattr(user, "is_superuser", False)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def login_view(request):
    """Authenticate user and return JWT token."""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        username=serializer.validated_data["username"],
        password=serializer.validated_data["password"],
    )

    if user is None:
        return Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    token = JWTAuthentication.generate_token(user)

    return Response({
        "token": token,
        "user": UserSerializer(user).data,
    })


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """Register a new user."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    token = JWTAuthentication.generate_token(user)

    return Response({
        "token": token,
        "user": UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def profile_view(request):
    """Get current user profile."""
    return Response(UserSerializer(request.user).data)


@api_view(["PUT", "PATCH"])
def profile_update_view(request):
    """Update the current user: name, email, avatar and/or password."""
    payload = request.data.copy()
    password = str(payload.pop("password", "") or "")
    current_password = str(payload.pop("current_password", "") or "")

    if password and current_password and not request.user.check_password(current_password):
        return Response(
            {"current_password": ["رمز عبور فعلی درست نیست."]}, status=status.HTTP_400_BAD_REQUEST
        )

    serializer = UserSerializer(request.user, data=payload, partial=True)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    if password:
        if len(password) < 8:
            return Response(
                {"password": ["رمز عبور باید حداقل ۸ کاراکتر باشد."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(password)
        user.save(update_fields=["password"])

    return Response(UserSerializer(user).data)


# ---- User Management (admin/CEO only) ----

@api_view(["GET", "POST"])
def users_list_create_view(request):
    """List all users or create a new user (admin/CEO only)."""
    if not _is_admin_or_ceo(request.user):
        return Response(
            {"error": "Permission denied"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == "GET":
        users = User.objects.all().order_by("-date_joined")
        return Response(UserSerializer(users, many=True).data)

    elif request.method == "POST":
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Optional permission matrix supplied with the new user.
        nested = request.data.get("permissions")
        if isinstance(nested, dict):
            flags = [
                "can_view", "can_pay", "can_issue", "can_manage_users",
                "can_manage_settings", "can_delete_history", "can_delete_payment",
                "can_export", "can_manage_companies", "can_submit", "can_approve",
                "can_edit_template",
            ]
            for flag in flags:
                if flag in nested:
                    setattr(user, flag, bool(nested[flag]))
            user.save()
        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def user_detail_view(request, pk):
    """Retrieve, update, or delete a user (admin/CEO only)."""
    if not _is_admin_or_ceo(request.user):
        return Response(
            {"error": "Permission denied"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(UserSerializer(user).data)

    elif request.method in ("PUT", "PATCH"):
        # Enforce role hierarchy: can only assign roles at or below your level
        ROLE_HIERARCHY = {"sales": 1, "finance": 2, "admin": 3, "ceo": 4}
        requested_role = request.data.get("role")
        if requested_role and requested_role in ROLE_HIERARCHY:
            caller_level = ROLE_HIERARCHY.get(request.user.role, 0)
            target_level = ROLE_HIERARCHY.get(requested_role, 0)
            if target_level > caller_level and not request.user.is_staff:
                return Response(
                    {"error": "Cannot assign a role higher than your own"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Use serializer for proper FK validation and error reporting
        serializer = UserSerializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        old_division = user.division_id
        old_team = user.team_id

        # Extract only mutable fields (skip read-only computed fields)
        allowed_fields = [
            "username", "email", "first_name", "last_name", "role", "department",
            "company", "division", "team", "reports_to",
        ]
        permission_flags = [
            "can_view", "can_pay", "can_issue", "can_manage_users",
            "can_manage_settings", "can_delete_history", "can_delete_payment",
            "can_export", "can_manage_companies", "can_submit", "can_approve",
            "can_edit_template",
        ]
        allowed_fields += permission_flags
        for field in allowed_fields:
            if field in serializer.validated_data:
                setattr(user, field, serializer.validated_data[field])

        # Optional password reset by an admin/CEO. UserSerializer has no password
        # field, so handle it explicitly instead of silently ignoring it.
        new_password = request.data.get("password")
        if new_password:
            if len(str(new_password)) < 8:
                return Response(
                    {"password": ["Password must be at least 8 characters."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.set_password(str(new_password))

        # Nested `permissions: {flag: bool}` from the user editor.
        nested = request.data.get("permissions")
        if isinstance(nested, dict):
            for flag in permission_flags:
                if flag in nested:
                    setattr(user, flag, bool(nested[flag]))

        user.save()

        # Auto-assignment: when a user is added to a division or team,
        # check if that org unit has existing dashboard assignments and
        # replicate them for the new user.
        new_division = user.division_id
        new_team = user.team_id
        try:
            if (new_division and new_division != old_division) or (new_team and new_team != old_team):
                from apps.dashboards.models import DashboardAssignment
                existing_assignments = DashboardAssignment.objects.filter(
                    is_active=True,
                ).filter(
                    models.Q(assigned_to__division_id=new_division) | models.Q(assigned_to__team_id=new_team)
                ).values_list('dashboard_id', 'data_filters', 'visible_pages').distinct()
                assigned_dash_ids = set()
                for dash_id, d_filters, v_pages in existing_assignments:
                    if dash_id not in assigned_dash_ids:
                        DashboardAssignment.objects.get_or_create(
                            dashboard_id=dash_id,
                            assigned_to=user,
                            defaults={
                                "assigned_by": request.user,
                                "data_filters": d_filters or [],
                                "visible_pages": v_pages or [],
                                "notes": f"خودکار: اضافه شده به ساختار سازمانی",
                                "is_active": True,
                            },
                        )
                        assigned_dash_ids.add(dash_id)
        except Exception:
            # Auto-assignment is best-effort; don't fail the user update if it errors
            pass

        return Response(UserSerializer(user).data)

    elif request.method == "DELETE":
        # Prevent self-deletion
        if user.id == request.user.id:
            return Response(
                {"error": "Cannot delete yourself"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---- Organization Management (Company → Division → Team) ----

@api_view(["GET", "POST"])
def company_list_create(request):
    """List all companies or create a new one (admin/CEO only)."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        companies = Company.objects.all()
        return Response(CompanySerializer(companies, many=True).data)
    elif request.method == "POST":
        serializer = CompanySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def company_detail(request, pk):
    """Retrieve, update, or delete a company."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    try:
        company = Company.objects.get(pk=pk)
    except Company.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(CompanySerializer(company).data)
    elif request.method == "PUT":
        serializer = CompanySerializer(company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    elif request.method == "DELETE":
        company.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
def division_list_create(request):
    """List divisions (optionally filtered by company) or create a new one."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        divisions = Division.objects.select_related("company", "manager").all()
        company_id = request.query_params.get("company_id")
        if company_id:
            divisions = divisions.filter(company_id=company_id)
        return Response(DivisionSerializer(divisions, many=True).data)
    elif request.method == "POST":
        serializer = DivisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def division_detail(request, pk):
    """Retrieve, update, or delete a division."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    try:
        division = Division.objects.select_related("company", "manager").get(pk=pk)
    except Division.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(DivisionSerializer(division).data)
    elif request.method == "PUT":
        serializer = DivisionSerializer(division, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    elif request.method == "DELETE":
        division.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
def team_list_create(request):
    """List teams (optionally filtered by division) or create a new one."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        teams = Team.objects.select_related("division", "division__company", "manager").all()
        division_id = request.query_params.get("division_id")
        company_id = request.query_params.get("company_id")
        if division_id:
            teams = teams.filter(division_id=division_id)
        elif company_id:
            teams = teams.filter(division__company_id=company_id)
        return Response(TeamSerializer(teams, many=True).data)
    elif request.method == "POST":
        serializer = TeamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def team_detail(request, pk):
    """Retrieve, update, or delete a team."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    try:
        team = Team.objects.select_related("division", "division__company", "manager").get(pk=pk)
    except Team.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(TeamSerializer(team).data)
    elif request.method == "PUT":
        serializer = TeamSerializer(team, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    elif request.method == "DELETE":
        team.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def org_tree(request):
    """Return the full organization tree: Companies → Divisions → Teams with members (admin/CEO only)."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    companies = Company.objects.prefetch_related(
        'divisions', 'divisions__teams', 'divisions__manager', 'divisions__teams__manager',
        'employees', 'divisions__employees', 'divisions__teams__members',
    ).all()

    result = []
    for company in companies:
        divs = []
        for div in company.divisions.all():
            teams = []
            for team in div.teams.all():
                members = [
                    {"id": m.id, "username": m.username, "name": f"{m.first_name} {m.last_name}".strip() or m.username, "role": m.role}
                    for m in team.members.all()
                ]
                teams.append({
                    "id": team.id,
                    "name": team.name,
                    "description": team.description,
                    "manager": team.manager.username if team.manager else None,
                    "manager_name": f"{team.manager.first_name} {team.manager.last_name}".strip() if team.manager else None,
                    "member_count": len(members),
                    "members": members,
                })
            div_employees = [
                {"id": e.id, "username": e.username, "name": f"{e.first_name} {e.last_name}".strip() or e.username, "role": e.role}
                for e in div.employees.all() if not e.team
            ]
            divs.append({
                "id": div.id,
                "name": div.name,
                "description": div.description,
                "manager": div.manager.username if div.manager else None,
                "manager_name": f"{div.manager.first_name} {div.manager.last_name}".strip() if div.manager else None,
                "teams": teams,
                "employees": div_employees,
            })
        company_employees = [
            {"id": e.id, "username": e.username, "name": f"{e.first_name} {e.last_name}".strip() or e.username, "role": e.role}
            for e in company.employees.all() if not e.division
        ]
        result.append({
            "id": company.id,
            "name": company.name,
            "description": company.description,
            "divisions": divs,
            "employees": company_employees,
        })

    return Response(result)


# ---- Custom Role Management (admin/CEO only) ----

@api_view(["GET", "POST"])
def role_list_create(request):
    """List all custom roles or create a new one (admin/CEO only)."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        roles = CustomRole.objects.filter(is_active=True)
        return Response(CustomRoleSerializer(roles, many=True).data)
    elif request.method == "POST":
        serializer = CustomRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def role_detail(request, pk):
    """Retrieve, update, or delete a custom role (admin/CEO only)."""
    if not _is_admin_or_ceo(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    try:
        role = CustomRole.objects.get(pk=pk)
    except CustomRole.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(CustomRoleSerializer(role).data)
    elif request.method == "PUT":
        serializer = CustomRoleSerializer(role, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    elif request.method == "DELETE":
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---- Module Management (system administrator only) ----

@api_view(["GET", "PUT"])
def company_modules(request, pk):
    """Get or update the enabled modules for a company."""
    if not _is_system_admin(request.user):
        return Response({"error": "Permission denied. Only System Administrator can manage modules."}, status=status.HTTP_403_FORBIDDEN)
    try:
        company = Company.objects.get(pk=pk)
    except Company.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(CompanyModulesSerializer(company).data)
    elif request.method == "PUT":
        modules = request.data.get("enabled_modules", [])
        # Validate: only allow known module IDs
        invalid = [m for m in modules if m not in ALL_MODULE_IDS]
        if invalid:
            return Response(
                {"error": f"Unknown modules: {', '.join(invalid)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        company.enabled_modules = modules
        company.save(update_fields=["enabled_modules"])
        return Response(CompanyModulesSerializer(company).data)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def user_modules(request):
    """Return the modules the current user can access."""
    user = request.user
    if not user.is_authenticated:
        return Response([])

    is_sysadmin = getattr(user, "is_superuser", False) or user.role == "admin"

    if is_sysadmin:
        modules = list(ALL_MODULE_IDS)
    elif user.company:
        modules = list(user.company.enabled_modules or [])
    else:
        # Default fallback to delivered business modules if company not assigned yet
        modules = [m for m in ("bi_dashboard", "finance", "crm", "office") if m in ALL_MODULE_IDS]

    # System Settings and Database Studio & Editor are strictly for System Administrator
    if not is_sysadmin:
        modules = [m for m in modules if m not in ("settings", "db_manager")]

    # Return module details
    module_map = {m[0]: m[1] for m in MODULE_CHOICES}
    result = [
        {"id": mid, "label": module_map.get(mid, mid)}
        for mid in modules
        if mid in module_map
    ]
    return Response(result)


# ---- System-wide branding (logo + brand colors) ----

BRAND_DEFAULTS = {
    "id": None,
    "name": "NEXIVO",
    "logo_url": None,
    "primary_color": "#3678F6",
    "accent_color": "#24C6B2",
}


def _own_company(user):
    """
    The caller's own company — never a fallback.

    Branding is tenant data, so an authenticated request must be scoped to the
    company of the requesting user. A user with no company must not be able to
    read or write another organization's branding (the previous fallback to the
    first active company allowed exactly that for a company-less admin).
    """
    if not user or not getattr(user, "is_authenticated", False):
        return None
    return getattr(user, "company", None)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def company_branding(request):
    """
    Read or update the system-wide branding for the caller's company.

    GET  — any authenticated user of that company.
    PUT  — CEO / Admin of that company. Accepts multipart (logo upload) or JSON.

    Strictly scoped to the caller's own company: there is no cross-tenant
    fallback here (only the public read falls back, for pre-login screens).
    """
    company = _own_company(request.user)

    if request.method in ("PUT", "PATCH"):
        if company is None:
            return Response(
                {"error": "You are not assigned to a company, so there is no branding to change. "
                          "Ask a superuser to assign your account to a company."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not _is_system_admin(request.user):
            return Response(
                {"error": "Only System Administrator can change system branding"},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Explicit logo removal (a blank ImageField value would be rejected)
        if str(request.data.get("clear_logo", "")).lower() in ("1", "true", "yes"):
            if company.logo:
                company.logo.delete(save=False)
            company.logo = None
            company.save(update_fields=["logo"])

        serializer = CompanyBrandingSerializer(
            company, data=request.data, partial=True, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    # GET
    if company is None:
        return Response(
            {"error": "You are not assigned to a company, so no branding is available."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(CompanyBrandingSerializer(company, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def branding_public(request):
    """
    Public branding for pre-login screens (the login page must match the tenant).
    Returns NEXIVO defaults when no company is configured.
    """
    company = Company.objects.filter(is_active=True).order_by("id").first()
    if company is None:
        return Response(BRAND_DEFAULTS)
    return Response(CompanyBrandingSerializer(company, context={"request": request}).data)


# ---- Organization fonts (DOCX/XLSX preview) ----

FONT_EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2"}
FONT_MAX_BYTES = 15 * 1024 * 1024


@api_view(["GET", "POST"])
def company_fonts(request):
    """List uploaded preview fonts; admins upload and delete them."""
    company = getattr(request.user, "company", None)
    if company is None:
        return Response({"detail": "کاربر به شرکتی متصل نیست."}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "GET":
        rows = CompanyFont.objects.filter(company=company)
        return Response([
            {"id": row.id, "name": row.name, "url": row.file.url, "created_at": row.created_at}
            for row in rows
        ])

    if not _is_admin_or_ceo(request.user):
        return Response({"detail": "آپلود فونت فقط برای مدیران مجاز است."}, status=status.HTTP_403_FORBIDDEN)

    upload = request.FILES.get("file")
    if upload is None:
        return Response({"file": ["فایل فونت ارسال نشده است."]}, status=status.HTTP_400_BAD_REQUEST)
    suffix = "." + upload.name.rsplit(".", 1)[-1].lower() if "." in upload.name else ""
    if suffix not in FONT_EXTENSIONS:
        return Response({"file": ["فقط فایل‌های ttf، otf، woff و woff2 پشتیبانی می‌شوند."]}, status=status.HTTP_400_BAD_REQUEST)
    if upload.size > FONT_MAX_BYTES:
        return Response({"file": ["حجم فونت باید کمتر از ۱۵ مگابایت باشد."]}, status=status.HTTP_400_BAD_REQUEST)

    name = (request.data.get("name") or upload.name.rsplit(".", 1)[0]).strip()
    if not name:
        return Response({"name": ["نام فونت الزامی است."]}, status=status.HTTP_400_BAD_REQUEST)
    font = CompanyFont.objects.create(
        company=company, name=name, file=upload, uploaded_by=request.user,
    )
    return Response(
        {"id": font.id, "name": font.name, "url": font.file.url, "created_at": font.created_at},
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE"])
def company_font_detail(request, pk):
    if not _is_admin_or_ceo(request.user):
        return Response({"detail": "حذف فونت فقط برای مدیران مجاز است."}, status=status.HTTP_403_FORBIDDEN)
    font = CompanyFont.objects.filter(pk=pk, company=getattr(request.user, "company", None)).first()
    if font is None:
        return Response({"detail": "فونت یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
    font.file.delete(save=False)
    font.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
