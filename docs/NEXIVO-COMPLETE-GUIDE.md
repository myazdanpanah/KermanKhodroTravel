# Nexivo — Complete Engineering & Operations Guide

> **Scope of this document.** Everything a developer, operator, designer or
> reseller needs to know about the Nexivo codebase as it exists today: how it is
> put together, how to run it, how the design system and white-labelling work,
> what is finished, what is fragile, and how to fork it for a specific customer.
>
> It is intentionally long. Use the table of contents; each section is written to
> be readable on its own.

---

## Table of Contents

1. [What Nexivo is](#1-what-nexivo-is)
2. [Repository map](#2-repository-map)
3. [Runtime architecture](#3-runtime-architecture)
4. [Technology stack](#4-technology-stack)
5. [Domain model & tenancy](#5-domain-model--tenancy)
6. [Authentication, roles & permissions](#6-authentication-roles--permissions)
7. [Backend applications](#7-backend-applications)
8. [API surface](#8-api-surface)
9. [Frontend architecture](#9-frontend-architecture)
10. [NEXIVO Design System](#10-nexivo-design-system)
11. [Company branding (white-labelling)](#11-company-branding-white-labelling)
12. [User management](#12-user-management)
13. [Local development](#13-local-development)
14. [Database, migrations & backups](#14-database-migrations--backups)
15. [Docker & production deployment](#15-docker--production-deployment)
16. [Testing & quality gates](#16-testing--quality-gates)
17. [Feature inventory](#17-feature-inventory)
18. [Known issues & technical debt](#18-known-issues--technical-debt)
19. [Forking Nexivo for a customer](#19-forking-nexivo-for-a-customer)
20. [Recent work (change log)](#20-recent-work-change-log)
21. [Glossary](#21-glossary)

---

## 1. What Nexivo is

Nexivo (نکسیوو, "Organization Operating System") is a modular ERP / BI platform
for Persian-speaking organisations. One deployment covers:

- **BI dashboards** — build dashboards from any connected data source, split them
  into pages, share them with roles, divisions or teams.
- **Finance** — chart of accounts, journal vouchers, invoices, receipts,
  payments, cheques, fiscal years, balance tracking.
- **Business modules** — CRM, sales, purchasing, inventory, manufacturing,
  trading, service sales, service management, HR, workflow engine.
- **Data tooling** — dataset upload, a database manager (external PostgreSQL /
  MySQL / SQL Server), SQL editor, Excel/CSV import, Google Sheets sync.
- **AI** — an LLM gateway (Ollama / OpenAI / Gemini / Anthropic) plus AI insight
  screens for anomalies, natural-language querying and forecasting.
- **Platform** — multi-tenant company structure, SSO (OIDC + SAML), audit trail,
  rate limiting, per-company module subscriptions and branding.

Everything is RTL-first, Persian-first, and self-hosted: fonts, assets, and
(optionally) the LLM all run without third-party CDNs.

### Delivery model

The product ships as a **single-tenant-per-install** system that is *logically*
multi-tenant: one installation can hold several `Company` rows, each with its own
enabled modules, users and branding. Customer forks usually keep one company row
and re-brand it.

---

## 2. Repository map

```
Nexivo/
├── backend/                     Django 4.2 project
│   ├── apps/                    23 Django apps (see §7)
│   ├── config/                  settings, urls, wsgi/asgi, celery
│   ├── manage.py
│   ├── requirements.txt
│   └── .env                     local secrets (git-ignored)
├── frontend/                    React 18 + Vite 5 SPA
│   ├── src/
│   │   ├── api/                 axios client + interceptors
│   │   ├── components/          shared UI (Toast, ThemeToggle, charts, …)
│   │   ├── design/tokens/       design-system JSON (source of truth)
│   │   ├── pages/               route-level screens, grouped by module
│   │   ├── store/               zustand stores (auth, branding)
│   │   └── utils/               roles, formatters, helpers
│   ├── public/brand/            logo assets (mark, lockup, dark variant)
│   ├── nginx.conf               production static/proxy config
│   └── tailwind.config.js       nx-* design tokens
├── docs/                        specifications and this guide
├── screenshots/                 captured UI evidence
├── mobile/                      React Native shell (early)
├── docker-compose.yml           dev: postgres, redis, superset, backend,
│                                celery, frontend
├── docker-compose.prod.yml      production compose
├── Makefile                     cross-platform task runner
├── dev.bat                      Windows-native equivalent of the Makefile
├── superset_config.py           Superset bootstrap configuration
├── CHANGELOG.md / PROGRESS.md   history and status notes
└── README.md                    public-facing documentation
```

### Where to look first

| I want to… | Start here |
|---|---|
| Change branding colours or logo | `backend/apps/accounts/{models,views,serializers}.py`, `frontend/src/store/brandingStore.ts`, `frontend/src/pages/SettingsPage.tsx` |
| Change a colour everywhere | `frontend/src/design/tokens/color-palette.json` → `frontend/tailwind.config.js` |
| Add a settings screen | `frontend/src/pages/SettingsPage.tsx` |
| Work on dashboards | `backend/apps/dashboards/`, `frontend/src/pages/Dashboard*Page.tsx` |
| Debug a 403 | `backend/apps/accounts/permissions.py`, `frontend/src/utils/roles.ts` |
| Understand the shell/navigation | `frontend/src/pages/ERPLayout.tsx`, `frontend/src/App.tsx` |

---

## 3. Runtime architecture

```
                    ┌────────────────────────────────────────────┐
  Browser (RTL)     │  React SPA (Vite dev :3000 / nginx :80)     │
  ────────────────► │  • zustand auth + branding stores           │
                    │  • axios → /api/v1/*                        │
                    └───────────────┬────────────────────────────┘
                                    │ HTTP (JWT Bearer)
                    ┌───────────────▼────────────────────────────┐
                    │  Django 4.2 + DRF (gunicorn :8000)         │
                    │  • function-based views per app            │
                    │  • JWT auth middleware                     │
                    │  • audit-log middleware (thread-local)     │
                    │  • rate limiting (Redis-backed)            │
                    └───┬───────────────┬────────────────┬───────┘
                        │               │                │
              ┌─────────▼──────┐ ┌──────▼──────┐ ┌───────▼────────┐
              │ PostgreSQL 15  │ │ Redis        │ │ Superset :8088 │
              │ app data       │ │ cache/queue  │ │ (BI engine,    │
              │ (host :5544)   │ │ throttles    │ │  optional)     │
              └────────────────┘ └──────┬───────┘ └────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ Celery worker     │
                              │ async jobs        │
                              └───────────────────┘
```

Key runtime facts:

- The SPA talks to **`/api/v1/...`** only. Dev uses the Vite proxy; production
  uses nginx to proxy `/api` and `/media`.
- JWTs are issued by `POST /api/v1/auth/login/` and stored by the `nexivo-auth`
  zustand persist store (localStorage key `nexivo-auth`).
- Branding is fetched publicly (`/api/v1/auth/branding/public/`) **before the
  first paint** so the login screen is never rendered in the wrong colours.
- `/media/*` serves uploaded logos; in dev Vite proxies it to Django.

---

## 4. Technology stack

### Backend

| Concern | Choice |
|---|---|
| Framework | Django 4.2 LTS |
| API | Django REST Framework 3.14 (function-based views, `@api_view`) |
| Auth | Custom JWT (`PyJWT`), `apps/accounts` middleware |
| Database | PostgreSQL 15 (`psycopg2-binary`) |
| Cache / throttle store | Redis 7 |
| Async | Celery 5 |
| WebSockets | `channels` + `daphne` |
| Files | Django `MEDIA_ROOT`, Pillow for image validation |
| SSO | `authlib` (OIDC), `python3-saml` (SAML) |
| Secrets at rest | `django-cryptography` (Fernet) |
| API docs | `drf-spectacular` |
| Data | `pandas`, `openpyxl`, Google Sheets/Drive clients |
| Server | gunicorn (container) |

### Frontend

| Concern | Version |
|---|---|
| React | 18.3 |
| Router | react-router-dom 6.26 (115 routes) |
| Build | Vite 5.4, TypeScript 5.5 |
| Styling | Tailwind CSS 3.4 (`nx-*` tokens) + small `antd` 6 islands |
| State | zustand 4.5 (`nexivo-auth`, `nexivo-brand` persist keys) |
| HTTP | axios 1.7 |
| Charts | recharts, custom `ChartWidget` |
| Icons | lucide-react |
| Fonts | `@fontsource/vazirmatn` 5.3 — self-hosted, no CDN |

---

## 5. Domain model & tenancy

```
Company (tenant)
 ├── name, description, logo, primary_color, accent_color
 ├── enabled_modules: ["bi_dashboard", "finance", …]
 ├── Division (واحد)
 │    └── Team (تیم)
 └── User (custom user model, accounts.User)
      ├── role: ceo | admin | finance | sales
      ├── department (free text)
      ├── company / division / team / reports_to
      └── is_staff
```

- A user **may have no company**. This is legal but restrictive: no branding
  write access, no module access (`accessible_modules` returns `[]`), and the
  launcher shows no modules. Assigning a company is done in Settings → کاربران.
- `Company.enabled_modules` is the subscription gate. Superusers and `admin`
  role users bypass it; everyone else sees the intersection of *company modules*
  and *role permissions*.
- `User.accessible_modules` is computed server-side and returned with the user
  payload so the launcher never has to guess.

### Roles at a glance

| Role | Level | Typical access |
|---|---|---|
| `sales` | 1 | Sales, CRM, own dashboards |
| `finance` | 2 | Finance, reporting |
| `admin` | 3 | Everything operational + user management + settings |
| `ceo` | 4 | Everything, including branding and destructive actions |

Role assignment is hierarchy-checked in `user_detail_view`: a non-staff caller
cannot assign a role above their own level.

---

## 6. Authentication, roles & permissions

- **Login**: `POST /api/v1/auth/login/` → `{ token, user }`. The token is a
  signed JWT containing user id, username and role.
- **Middleware**: validates the `Authorization: Bearer <token>` header, rejects
  disabled users, and attaches `request.user`.
- **Registration**: `POST /api/v1/auth/register/` (public in dev, used by
  `create_dev_data`).
- **Password change (self)**: `POST /api/v1/auth/change-password/`.
- **Password reset (admin)**: `PUT /api/v1/auth/users/<id>/` with a `password`
  field (minimum 8 characters).
- **Guards**: `_is_admin_or_ceo()` gates management endpoints; company-scoped
  endpoints resolve the tenant from `request.user.company` — never from client
  input.
- **SSO**: `apps/sso` implements OIDC and SAML flows with per-IP throttles and
  encrypted client secrets/certificates.

### Common failure modes

| Symptom | Cause |
|---|---|
| 403 with `{"error": "Permission denied"}` | Role is not admin/CEO |
| 403 `You are not assigned to a company…` | User has no `company`; assign one in Settings → کاربران |
| 400 `You are not assigned to a company…` | Same, on the branding read |
| 401 on every request | Token expired or `Authorization` header missing |

---

## 7. Backend applications

| App | Responsibility |
|---|---|
| `accounts` | Company/Division/Team/User, roles, branding, user management, modules |
| `core` | Shared base models, utilities, auto-registered models |
| `dashboards` | Dashboards, pages, widgets, assignments, audit log of shares |
| `datasets` | Dataset upload and profiling |
| `db_manager` | External DB connections, SQL execution, table/schema editing |
| `finance` | COA, journals, invoices, receipts, payments, cheques, fiscal years |
| `crm` | Leads, customers, opportunities, campaigns |
| `sales` | Quotes, orders, posting to finance |
| `purchasing` | Purchase requests, orders, vendors |
| `inventory` | Items, stock, movements |
| `manufacturing` | BOMs, production orders |
| `trading` | Trade/import-export workflows |
| `service_sales` | Bookings, tickets, tours, hotels, refunds, commissions |
| `service_management` | Service desk / SLAs |
| `hr` | Employees, departments, attendance, payroll scaffolding |
| `reporting` | Cross-module reporting |
| `ai_insights` | Anomalies, NL query, forecasting |
| `llm` | Provider config, chat, usage tracking |
| `workflow` | Definitions, instances, SLA rules, history |
| `audit_log` | Model-level audit trail + diff viewer API |
| `multi_tenant` | Tenant helpers and scoping utilities |
| `rate_limiting` | Throttle models and middleware |
| `sso` | OIDC/SAML login |

---

## 8. API surface

Base URL: `/api/v1/`. All routes require a Bearer token unless stated.

### Platform & auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login/` | public |
| POST | `/auth/register/` | public in dev |
| GET | `/auth/profile/` | current user |
| PUT | `/auth/profile/` | update own profile |
| POST | `/auth/change-password/` | old + new password |
| GET/POST | `/auth/users/` | admin/CEO; list returns a bare array |
| GET/PUT/DELETE | `/auth/users/<id>/` | PUT accepts optional `password` |
| GET/POST | `/auth/companies/` | tenant CRUD |
| GET/POST | `/auth/divisions/`, `/auth/teams/` | org structure |
| GET/POST | `/auth/roles/` | custom roles |
| GET | `/auth/company/branding/` | own company branding (400 if no company) |
| PUT/PATCH | `/auth/company/branding/` | CEO/admin (403 if no company) |
| GET | `/auth/branding/public/` | **AllowAny**, first active company or defaults |
| POST | `/auth/sso/initiate/`, `/auth/sso/callback/` | throttled |

### Branding payload

```json
{
  "id": 1,
  "name": "…",
  "logo": null,
  "logo_url": "/media/companies/logo.png",
  "primary_color": "#3678F6",
  "accent_color": "#24C6B2"
}
```

Writes accept `primary_color`, `accent_color` (strict `#RRGGBB`), `logo`
(multipart) and `clear_logo: true`.

### Everything else

Dashboards (`/dashboards/…`), pages, widgets, assignments, datasets
(`/datasets/…`), DB manager (`/db-manager/…`), finance (`/finance/…`), CRM, sales,
purchasing, inventory, manufacturing, trading, service sales, HR, reporting,
AI insights, LLM, workflow, audit log. The full interactive schema is served by
`drf-spectacular` at `/api/schema/` (+ `/api/docs/`).

---

## 9. Frontend architecture

### Layer map

```
src/
├── api/client.ts        axios instance, baseURL from VITE_API_URL, JWT header
├── store/authStore.ts   zustand persist: token + user
├── store/brandingStore.ts brand colours/logo → CSS variables, pre-paint cache
├── components/          Toast, ThemeToggle, NotificationBell, ChartWidget, …
├── pages/
│   ├── LoginPage, LauncherPage, SplashScreen
│   ├── ERPLayout.tsx    module shell: sidebar, header, content canvas
│   ├── SettingsPage.tsx Settings hub (Branding tab lives here)
│   ├── AdminSettingsPage.tsx Users / Roles / Audit
│   ├── Dashboard*Page   BI builder, list, assignment
│   └── <module>/        finance, crm, hr, sales, …
└── utils/roles.ts       role labels, colours, ALL_ROLES
```

### Boot sequence (important)

1. `index.html` → `main.tsx`.
2. `brandingStore` applies cached branding (`localStorage.nexivo-brand`) **inline
   before React renders**, so there is no colour flash.
3. `SplashScreen` shows the glowing logo while the module list / session is
   resolved, then holds a minimum of **900 ms** and plays a **420 ms** flash
   before the launcher or the requested route appears.
4. `PrivateRoute` guards authenticated routes; unauthenticated users go to
   `/login`.

### Navigation model

- `/` → launcher (module grid, filtered by `accessible_modules`).
- `/erp/...` → module shell (`ERPLayout`) with sidebar grouped by domain.
- `/dashboards`, `/db-manager`, `/data/upload`, `/org-chart`, `/admin/*` →
  standalone screens with their own headers.
- 115 routes are declared in `src/App.tsx`; heavy pages are lazy-loaded with a
  route-level fallback that shows the logo mark.

### Theming pipeline

```
color-palette.json ─► tailwind.config.js ─► utility classes
                                          ├─ static tokens (navy, mist, border, muted, danger, warning)
                                          └─ runtime tokens (blue, teal) as `rgb(var(--nx-blue) / α)`
Company.primary_color / accent_color ─► GET /auth/branding/public/ ─► brandingStore
    ─► document.documentElement.style.setProperty('--nx-blue', '54 120 246')
```

Because `nx-blue` / `nx-teal` are CSS variables, a company colour change applies
**without a rebuild** — only a reload.

---

## 10. NEXIVO Design System

Source of truth: `frontend/src/design/tokens/*.json`. Components must use tokens,
never raw hex values.

### Brand palette

| Token | Name | Hex | Usage |
|---|---|---|---|
| `nx-navy` | Deep Navy | `#101D35` | OS canvas, primary text |
| `nx-navy-elevated` | — | `#1E2A42` | elevated dark surface |
| `nx-navy-border` | — | `#2C4060` | elevated border |
| `nx-blue` | Intelligence Blue | `#3678F6` | action signal (runtime) |
| `nx-teal` | Digital Teal | `#24C6B2` | success signal (runtime) |
| `nx-mist` | Silver Mist | `#A5B4CC` | disabled / separators |
| `nx-border` | — | `#E5E7EB` | default border |
| `nx-muted` | — | `#6B7280` | disabled text |

### Status palette (added this cycle)

| Token | Name | Base | Role |
|---|---|---|---|
| `nx-danger` | Signal Red | `#EF4444` | error, destructive, failed |
| `nx-warning` | Caution Amber | `#F59E0B` | warning, pending, needs attention |

Both ship a full `50…950` scale. They exist so error/warning colouring is
semantic and themeable, and so no component depends on raw Tailwind palettes.
`success` intentionally reuses `nx-teal` — do not introduce a second green.

**Migration note:** all former `red|rose` utilities now use `nx-danger`, all
former `amber|yellow|orange` utilities use `nx-warning`. The shades are identical
to the previous Tailwind values (except `rose → red` and `yellow/orange → amber`
hue alignment), so this was a lossless refactor.

### Type, radius, shadow

- Typeface: **Vazirmatn**, self-hosted through `@fontsource/vazirmatn`
  (15 woff2 files in the build, zero CDN references).
- Radius: `rounded-nx-card` = 12px, `rounded-nx-btn` = 4px.
- Shadow: `shadow-nx-card`, `shadow-nx-elevated`.

### Component rules

- Surfaces: `bg-white dark:bg-nx-navy`; elevated dark surfaces use
  `bg-nx-navy-elevated`.
- The ERP content canvas is **Deep Navy**; cards inside it are elevated surfaces.
- Body copy on dark: `text-nx-mist`; headings: white.
- Focus rings: `ring-nx-blue`.
- Do not use `gray-*`, `indigo-*`, `emerald-*`, or bare `red/amber` utilities.

### Known gaps

- 99 headings in older modal-heavy screens still use navy text on dark (heuristically migrated).
- Some white cards inside dark pages retain pale secondary text.
- `antd` islands (service sales, purchasing tags) still use antd's own palette.

---

## 11. Company branding (white-labelling)

### Model

`Company` gained `primary_color`, `accent_color` (validated `#RRGGBB`) in
migration `0006_company_accent_color_company_primary_color`. `logo` already
existed.

### Endpoints

| Method | Path | Auth | Behaviour |
|---|---|---|---|
| GET | `/auth/company/branding/` | any user | own company only; **400** if no company |
| PUT/PATCH | `/auth/company/branding/` | CEO/admin | own company only; **403** if no company |
| GET | `/auth/branding/public/` | anonymous | first active company, or NEXIVO defaults |

There is **no fallback to "the first company"** on the authenticated endpoint —
that fallback exists only for the public read used by the login screen, because
an anonymous visitor has no tenant to scope to. This closes the cross-tenant
write hole where a company-less admin could have edited another tenant's branding.

### UI

Settings → **برندینگ** (`frontend/src/pages/SettingsPage.tsx`):

- logo upload with live preview, plus "remove logo"
- primary and accent colour pickers + hex inputs
- reset to NEXIVO defaults
- errors surface the backend's `error` message verbatim

### Applying branding at runtime

`brandingStore` writes `--nx-blue` / `--nx-teal` as space-separated RGB triples
on `:root`, mirrors the values into `localStorage.nexivo-brand` for pre-paint
application, and exposes `useBrandLogo()` which returns the uploaded logo URL or
the shipped default mark/lockup.

### Logo assets

`frontend/public/brand/`:

| File | Use |
|---|---|
| `nexivo-mark.webp` | logo-only contexts (sidebar, splash, favicon source) |
| `nexivo-lockup.webp` | logo + wordmark (login, launcher header) |
| `nexivo-logo-dark.png` | light-recoloured mark for dark surfaces |

---

## 12. User management

Route: `/erp/settings/users` → `AdminSettingsPage.tsx` (admin/CEO only; other
roles are redirected to `/dashboards`).

Capabilities:

- **List** users with role and org structure.
- **Create** a user: username, email, first/last name, role, department,
  password (≥8), company, division, team, reports-to.
- **Edit** the same fields; username is read-only after creation; a new password
  is optional and only sent when typed.
- **Delete** a user (self-delete is blocked).
- **Roles** tab: custom role labels/colours.
- **Audit** tab: audit-log entries rendered from `/dashboards/audit-log/`.

Server-side rules worth knowing:

- Role hierarchy is enforced on update; a non-staff caller cannot assign a role
  above their own.
- Adding a user to a division/team replicates existing dashboard assignments for
  that unit (best-effort, non-fatal).
- `accessible_modules` is recalculated from the company's `enabled_modules`.

Tests: `CompanyBrandingScopeTests`, `CompanyBrandingAccessTests`,
`CompanyBrandingLogoTests`, `BrandingPublicDefaultsTests`, `UserManagementTests`
in `backend/apps/accounts/tests.py`.

---

## 13. Local development

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker Desktop (for PostgreSQL/Redis/Superset)
- Windows: `dev.bat`; macOS/Linux: `make`

### Ports and containers

| Service | Host port | Container |
|---|---|---|
| PostgreSQL | **5544** → 5432 | `nexivo_db` |
| Redis | 6379 | `nexivo_redis` |
| Django | 8000 | — |
| Vite | 3000 | — |
| Superset | 8088 | `nexivo_superset` |

> `backend/.env` points `DB_PORT=5544`. The container is started with
> `-p 5544:5432` because port 5432 is often already taken locally.

### Quick start (Windows)

```bat
dev.bat start-services     :: postgres + redis
dev.bat setup              :: install, migrate, seed
dev.bat backend            :: terminal 1
dev.bat frontend           :: terminal 2
```

### Quick start (macOS/Linux)

```bash
make start-services
make setup
make backend      # terminal 1
make frontend     # terminal 2
```

### Manual equivalent

```bash
docker start nexivo_db nexivo_redis
cd backend && source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
python manage.py migrate
python manage.py create_dev_data
python manage.py runserver 127.0.0.1:8000 --noreload
cd frontend && npm install && npm run dev
```

### Seeded users

`python manage.py create_dev_data` is idempotent and (re)sets these passwords:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin12345` | admin |
| `ceo` | `ceo123456` | ceo |
| `finance` | `finance123` | finance |
| `sales` | `sales12345` | sales |

> **They start with no company.** Assign one in Settings → کاربران (or via
> `PUT /auth/users/<id>/ {"company": 1}`) before using branding or modules.

### Task reference (`dev.bat` == `make`)

| Task | Effect |
|---|---|
| `install` | pip install + npm install |
| `setup` | install → migrate → seed |
| `migrate` / `seed` | Django migrations / dev data |
| `start-db`, `start-redis`, `start-services` | start containers |
| `backend`, `frontend` | run one dev server |
| `dev` | migrate + seed + both servers |
| `stop` | **stop** containers only — volumes and data are preserved |
| `clean` | remove containers **and volumes** (destroys the DB) |
| `dump` | `pg_dump` snapshot into `backups/` |
| `restore FILE=…` | restore a snapshot (default: newest) |
| `test-backend` / `test-frontend` | Django check / TypeScript typecheck |

> `stop` never removes containers: removing the `nexivo_db` container would delete
> the development database.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `connection refused` on 5544 | `docker start nexivo_db` |
| Login works but the launcher is empty | User has no company → assign one |
| Branding tab shows a 403 | Same cause; the message says so |
| Colours changed in `tailwind.config.js` don't appear | Restart Vite — theme keys are not hot-reloaded |
| Backend edits don't apply | Server runs with `--noreload`; restart it |
| `make: command not found` (Git Bash on Windows) | Use `dev.bat` |

### Logs

`django-dev.log`, `frontend-dev.log` at the repo root (git-ignored).

---

## 14. Database, migrations & backups

- PostgreSQL 15; database `nexivo`, user `nexivo_user`.
- 160+ tables across the apps; migrations are per-app (`backend/apps/*/migrations`).
- Adding a model: create it in the app, run `makemigrations <app>`, then
  `migrate`. Models extending `core` base classes are auto-registered for audit.
- **Snapshot**: `dev.bat dump` → `backups/nexivo_<timestamp>.sql` (pg_dump custom
  SQL, 166 tables ≈ 1 MB on dev data).
- **Restore**: `dev.bat restore FILE=backups/x.sql` (defaults to newest).
  Restores are verified against a scratch database (`nexivo_restore_test`).
- `backups/` is git-ignored.

### Backup recommendations for production

1. Nightly `pg_dump` to off-host storage, retention 30 days.
2. Snapshot `MEDIA_ROOT` (uploaded logos, imports) alongside the DB.
3. Test a restore quarterly — an untested backup is not a backup.

---

## 15. Docker & production deployment

`docker-compose.yml` (development) and `docker-compose.prod.yml` (production)
define:

| Service | Purpose |
|---|---|
| `postgres` | database, volume `postgres_data` |
| `redis` | cache, throttles, Celery broker |
| `superset` | optional BI engine, volume `superset_data` |
| `backend` | gunicorn + Django |
| `celery` | async worker |
| `frontend` | nginx serving the built SPA, proxying `/api` and `/media` |

### Build & run

```bash
docker compose build          # rebuild images after code changes
docker compose up -d
docker compose logs -f backend
```

Images: `nexivo-frontend` ≈ 909 MB, `nexivo-backend` / `nexivo-celery` ≈ 1.15 GB.

### Production checklist

- [ ] `DEBUG=0`, strong `SECRET_KEY`, rotated DB password
- [ ] `ALLOWED_HOSTS` / CORS set to the customer domain
- [ ] HTTPS termination + `SECURE_*` headers
- [ ] Media volume mounted and backed up
- [ ] Celery worker running (dashboards/exports depend on it)
- [ ] `docker compose build` run after branding/design changes
- [ ] Superset optional — the app degrades gracefully when absent

---

## 16. Testing & quality gates

### Backend

```bash
cd backend
python manage.py check
python manage.py test --verbosity=2          # 21 test modules, 200+ assertions
python manage.py test apps.accounts.tests    # one app
```

Coverage highlights:

- `accounts`: login, register, JWT, branding (scope, roles, logo, defaults),
  user management (create/update/password reset/delete/permissions).
- `dashboards`, `datasets`, `finance`, `sales`, `service_sales`, `crm`,
  `ai_insights`, `multi_tenant`, `sso`, `audit_log`, `workflow`, `hr`, `llm`,
  `inventory`, `purchasing`, `manufacturing`, `trading`, `reporting`,
  `rate_limiting`, `db_manager`.
- Shared fixtures: `apps/accounts/tests_helpers.py`
  (`create_test_company`, `create_test_user`).

### Frontend

```bash
cd frontend
npx tsc --noEmit     # type gate
npm run build        # production bundle gate
npm run lint         # eslint
```

### CI

`.github/workflows/tests.yml` runs on every push/PR to `main`:
PostgreSQL 15 service → `check` → `migrate` → `test`, plus Node 20 →
`tsc --noEmit`.

---

## 17. Feature inventory

| Area | State | Notes |
|---|---|---|
| Auth / JWT / roles | ✅ | hierarchy enforced on update |
| Company / division / team | ✅ | full CRUD |
| Module subscription | ✅ | `enabled_modules` + role gates |
| Branding (logo + colours) | ✅ | company-scoped writes, public read |
| Design system | ✅ | tokens incl. status colours |
| Splash / logo / favicon | ✅ | glow + flash transition |
| User management | ✅ | create/edit/delete/reset password |
| BI dashboards | ✅ | pages, widgets, sharing, assignment |
| Dataset upload / DB manager | ✅ | external DBs, SQL editor, imports |
| Finance | ✅ | COA, journals, invoices, cheques, fiscal years |
| CRM / sales / purchasing / inventory | ✅ | posting bridges to finance |
| Manufacturing / trading | 🟡 | core flows, thin UI in places |
| Service sales / management | 🟡 | antd-based screens |
| HR | 🟡 | employees/attendance; payroll scaffolding |
| Reporting | 🟡 | cross-module views |
| AI insights / LLM gateway | 🟡 | provider-agnostic, needs keys |
| Workflow engine | 🟡 | definitions/instances/SLA |
| SSO (OIDC/SAML) | ✅ | throttled, secrets encrypted |
| Audit log | ✅ | model-level diffs, viewer UI |
| Mobile app | 🟡 | shell only |

---

## 18. Known issues & technical debt

**Data/contract**

1. Several HR/CRM list screens expect a bare array while their APIs return
   `{ success, data: [...] }` → red "خطا در دریافت…" toasts.
2. Finance screens show `ناعدد ریال` (NaN) when no fiscal year exists.

**Design system**

3. No error/warning tokens existed before this cycle — resolved; keep new code on
   `nx-danger` / `nx-warning`.
4. 99 headings in modal-heavy screens still use navy text on dark surfaces.
5. White cards inside dark pages can keep pale secondary text.
6. `antd` islands (service sales, purchasing) bypass the token layer.

**Platform**

7. Seeded dev users have no company; branding/modules 403 until assigned.
8. `make` is not available in Git Bash on Windows — use `dev.bat`.
9. Some background jobs assume Superset is running.
10. No automated E2E suite; verification is typecheck + build + manual preview.

**Security hygiene**

11. Dev secret key is the placeholder from `.env.example`.
12. `DEBUG=1` locally; must be flipped for production.
13. Rate limits are per-IP; consider per-user for authenticated endpoints.

---

## 19. Forking Nexivo for a customer

This is the checklist used to create a customer-specific fork (for example the
Kerman Khodro Travel fork at `C:\KermanKhodroTravel`).

### 19.1 Clone and isolate

```bash
git clone https://github.com/myazdanpanah/nexivo.git C:\CustomerName
cd C:\CustomerName
git remote rename origin upstream          # keep upstream for updates
git remote add origin <customer-repo-url>  # optional customer origin
git checkout -b customer/<name>
```

Never commit `backend/.env`, `frontend/.env`, `backups/`, logs or media.

### 19.2 Environment

```bash
cp .env.example backend/.env
```

Set at minimum: `SECRET_KEY`, `DEBUG`, `POSTGRES_*`, `DB_PORT` (5544 locally),
`REDIS_URL`. For production also `ALLOWED_HOSTS`, CORS origins, and HTTPS flags.

### 19.3 Brand the installation

1. Start the stack (`dev.bat start-services`, `dev.bat setup`).
2. Create/rename the single company row (Django admin or
   `POST /auth/companies/`).
3. Assign `admin` and `ceo` to that company in Settings → کاربران.
4. Settings → برندینگ: upload the customer logo, set primary and accent colours,
   save, reload. Everything (sidebar, splash, login, buttons, charts) follows.
5. Replace `frontend/public/brand/*` with the customer's real assets and regenerate
   the favicon if a permanent identity is wanted.

### 19.4 Module set

Set `Company.enabled_modules` to only what the customer bought, e.g.:

```json
["bi_dashboard", "finance", "crm", "sales", "settings"]
```

The launcher and sidebar hide everything else; direct URLs are refused server-side.

### 19.5 Content & data

- Seed org structure: divisions → teams → users (Settings → کاربران).
- Create a fiscal year before entering finance data (avoids the NaN amounts).
- Import the customer's opening balances/invoices via the importer.
- Take a `dump` immediately after seeding, before go-live.

### 19.6 White-label checklist

- [ ] Logo (light + dark), favicon, splash mark
- [ ] Primary/accent colours match the brand and pass contrast on navy
- [ ] Company name, description, division/team tree
- [ ] Users created with correct role and company
- [ ] `enabled_modules` trimmed
- [ ] Persian copy reviewed (no leftover Nexivo marketing strings)
- [ ] Email/notification sender text if applicable
- [ ] Docs/SLA handed over; admin trained on Branding + Users
- [ ] Backups scheduled and a restore rehearsed

### 19.7 Keeping the fork current

```bash
git fetch upstream
git merge upstream/main     # resolve conflicts in branding/assets
```

Prefer configuration (branding, modules, data) over code divergence: the less the
fork patches, the cheaper every upstream update becomes. When a change *is*
customer-specific, isolate it in one file (e.g. a constants module) rather than
scattering conditionals.

---

## 20. Recent work (change log)

This cycle delivered the following (all verified with typecheck/build and,
where behavioural, with tests and live API calls):

1. **Local stack made reproducible** — Postgres published on host port 5544;
   `stop` no longer removes containers (data-loss bug); `dump`/`restore` targets;
   `nul` artifact deleted and Windows reserved names added to `.gitignore`;
   `dev.bat` brought in line with the Makefile.
2. **Splash screen & logos** — glowing logo while loading, subtle flash, then the
   modules; logo+wordmark on login, mark elsewhere; favicon; lazy-route fallback.
3. **Design system applied across the app** — `nx-*` tokens in Tailwind, ~6,400
   utilities migrated (gray→navy/mist/muted/border, indigo/blue→nx-blue,
   emerald/green→nx-teal), 371 borders, 70 surfaces, 15 gradients, ERP canvas set
   to Deep Navy; Vazirmatn self-hosted with zero CDN references.
4. **Runtime theming** — `nx-blue`/`nx-teal` became CSS variables so company
   colours apply without a rebuild.
5. **Company branding feature** — model fields, serializers, three endpoints,
   Settings → Branding UI with upload/preview/reset, `/media` proxying in Vite
   and nginx.
6. **Branding security scoping** — authenticated endpoint now strictly uses the
   caller's company (400 read / 403 write without one); the first-active-company
   fallback survives only on the public endpoint. Seven regression tests.
7. **User management hardened** — admin password reset via `PUT` (was silently
   ignored), optional password field in edit mode, six management tests, verified
   end-to-end in the browser (create, edit, assign company, delete).
8. **Status colour tokens** — `nx-danger` / `nx-warning` added to the palette and
   Tailwind (50–950); 245 lines across 71 files migrated off raw
   red/amber/yellow/orange/rose utilities; zero legacy utilities remain.
9. **BI dashboard header cleaned** — removed data upload, DB manager, org chart,
   org structure, dashboard assignment and user management shortcuts, leaving
   identity, notifications, theme and logout.

---

## 21. Glossary

| Term | Meaning |
|---|---|
| **Company** | Tenant row; owns users, modules and branding |
| **Division / Team** | Org units under a company; drive dashboard assignment |
| **Module** | Feature area gated by `Company.enabled_modules` + role |
| **Launcher** | `/` module grid shown after login |
| **ERP shell** | `/erp/...` chrome with sidebar navigation |
| **Token** | A named design value (`nx-blue`, `nx-danger-500`) |
| **Branding** | Per-company logo + primary/accent colour overrides |
| **Accessible modules** | Server-computed list of modules a user may open |
| **Dump / Restore** | Local DB snapshot and reload via `dev.bat` / `make` |

---

*Last updated for the current development cycle. Keep this file in sync whenever
architecture, tokens, endpoints or workflows change.*
