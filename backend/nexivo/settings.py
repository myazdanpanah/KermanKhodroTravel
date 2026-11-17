"""
Django settings for Nexivo project.
"""

import os
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

# Security
SECRET_KEY = config("SECRET_KEY", default="django-insecure-change-me-in-production")
DEBUG = config("DEBUG", default="0", cast=bool)
ALLOWED_HOSTS = ["*"]

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    # Local apps
    "apps.core.apps.CoreConfig",
    "apps.accounts.apps.AccountsConfig",
    "apps.billing.apps.BillingConfig",
    "apps.datasets.apps.DatasetsConfig",
    "apps.dashboards.apps.DashboardsConfig",
    "apps.db_manager.apps.DbManagerConfig",
    "apps.finance.apps.FinanceConfig",
    "apps.llm.apps.LlmConfig",
    "apps.manufacturing.apps.ManufacturingConfig",
    "apps.workflow.apps.WorkflowConfig",
    "apps.inventory.apps.InventoryConfig",
    "apps.purchasing.apps.PurchasingConfig",
    "apps.sales.apps.SalesConfig",
    "apps.trading.apps.TradingConfig",
    "apps.service_sales.apps.ServiceSalesConfig",
    "apps.service_management.apps.ServiceManagementConfig",
    "apps.crm.apps.CRMConfig",
    "apps.hr.apps.HRConfig",
    "apps.reporting.apps.ReportingConfig",
    "apps.ai_insights.apps.AiInsightsConfig",
    "apps.rate_limiting.apps.RateLimitingConfig",
    "apps.multi_tenant.apps.MultiTenantConfig",
    "apps.sso.apps.SSOConfig",
    "apps.audit_log.apps.AuditLogConfig",
]

# Rate Limiting
RATE_LIMIT_DEFAULT_REQUESTS_PER_MINUTE = 60

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.accounts.middleware.RoleMiddleware",
    "apps.rate_limiting.throttling.RateLimitLoggingMiddleware",
    "apps.audit_log.middleware.AuditLogMiddleware",
]

ROOT_URLCONF = "nexivo.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "nexivo.wsgi.application"
ASGI_APPLICATION = "nexivo.asgi.application"

# Database
# Detect if running inside Docker (DB_HOST defaults to 'postgres' in docker-compose)
def _resolve_db_host():
    host = config("DB_HOST", default="localhost")
    if host == "postgres" and not os.path.exists("/.dockerenv"):
        return "localhost"
    return host

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="nexivo"),
        "USER": config("POSTGRES_USER", default="nexivo_user"),
        "PASSWORD": config("POSTGRES_PASSWORD", default="nexivo_pass"),
        "HOST": _resolve_db_host(),
        "PORT": config("DB_PORT", default="5432"),
    }
}

# Custom User Model
AUTH_USER_MODEL = "accounts.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "fa-ir"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "static"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "apps.accounts.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    # Throttling
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "llm_chat": "20/minute",
        "nl_query": "30/minute",
        "alert": "60/minute",
    },
}

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_CREDENTIALS = True

# JWT Settings
JWT_SECRET = config("SECRET_KEY", default=SECRET_KEY)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Superset Integration
SUPERSET_API_URL = config("SUPERSET_API_URL", default="http://superset:8088/api/v1")
SUPERSET_USERNAME = config("SUPERSET_USERNAME", default="admin")
SUPERSET_PASSWORD = config("SUPERSET_PASSWORD", default="admin")
SUPERSET_DEFAULT_DATABASE_ID = config("SUPERSET_DEFAULT_DATABASE_ID", default=1, cast=int)

# Redis / Celery
REDIS_URL = config("REDIS_URL", default="redis://redis:6379/0")
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

# Django Channels (WebSocket support for real-time alerts)
try:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        },
    }
except Exception:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }

# DRF Spectacular (OpenAPI)
SPECTACULAR_SETTINGS = {
    "TITLE": "Nexivo ERP API",
    "DESCRIPTION": "Nexivo ERP — OpenAPI documentation for all modules:\n\n- **Finance** — Invoices, receipts, payments, cheques, chart of accounts\n- **Inventory** — Warehouses, stock movements, reservations\n- **Purchasing** — Purchase orders, requests, goods receipts\n- **Sales** — Quotations, orders, invoices, returns\n- **Manufacturing** — BOMs, routings, work centers, production orders, QC\n- **Trading** — Import/export orders, containers, shipments\n- **Service Sales** — Bookings, tickets, tours, hotels, passengers\n- **Service Management** — Requests, work orders, technicians, contracts, SLA\n- **CRM** — Leads, opportunities, activities, campaigns\n- **HR** — Employees, attendance, departments, payroll, evaluations\n- **Reporting** — Report templates, dashboards, KPIs, scheduled reports\n- **AI Insights** — Anomaly detection, forecasting, NL queries\n- **SSO & Identity** — SAML/OIDC provider management, JIT provisioning\n- **Rate Limiting** — Per-module throttling\n- **Multi-Tenant** — Tenant provisioning and management",
    "VERSION": "0.16.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "TAGS": [
        {"name": "Auth", "description": "JWT authentication and user management"},
        {"name": "Finance", "description": "Invoices, receipts, payments, and accounting"},
        {"name": "Inventory", "description": "Warehouses, stock movements, reservations"},
        {"name": "Purchasing", "description": "Purchase orders and goods receipts"},
        {"name": "Sales", "description": "Quotations, orders, invoices, returns"},
        {"name": "Manufacturing", "description": "BOMs, routings, work centers, production orders"},
        {"name": "Trading", "description": "Import/export orders and shipments"},
        {"name": "Service Sales", "description": "Bookings, tickets, tours, hotels"},
        {"name": "Service Management", "description": "Requests, work orders, technicians, SLA"},
        {"name": "CRM", "description": "Leads, opportunities, activities, campaigns"},
        {"name": "HR", "description": "Employees, attendance, departments, payroll"},
        {"name": "Reporting", "description": "Report templates, dashboards, KPIs"},
        {"name": "AI Insights", "description": "Anomaly detection, forecasting, NL queries"},
        {"name": "SSO", "description": "SAML/OIDC identity providers and JIT provisioning"},
        {"name": "Rate Limiting", "description": "Per-module throttling configuration"},
        {"name": "Multi-Tenant", "description": "Tenant provisioning and management"},
    ],
}

# Rate Limiting
RATE_LIMIT_DEFAULT_REQUESTS_PER_MINUTE = 60
RATE_LIMIT_DEFAULT_REQUESTS_PER_HOUR = 1000
RATE_LIMIT_DEFAULT_REQUESTS_PER_DAY = 10000
RATE_LIMIT_LOG_RETENTION_DAYS = 90

# Role choices
ROLE_FINANCE = "finance"
ROLE_SALES = "sales"
ROLE_CEO = "ceo"
ROLE_ADMIN = "admin"
ROLE_UPDATER = "updater"
ROLE_CHOICES = [
    (ROLE_FINANCE, "Finance"),
    (ROLE_SALES, "Sales"),
    (ROLE_CEO, "CEO"),
    (ROLE_ADMIN, "Admin"),
    (ROLE_UPDATER, "Updater"),
]
