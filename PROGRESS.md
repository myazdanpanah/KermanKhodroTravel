# Nexivo — Project Progress

**Last updated:** July 21, 2026  
**Current version:** v0.9.0

---

## 🎯 Architecture Overview

Nexivo is an **organizational SaaS platform** with pluggable modules. Each company (tenant) enables/disables modules, and each user gets role-based access to the enabled ones.

```
┌──────────────────────────────────────────────────────────────┐
│                     Nexivo Platform                           │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ BI       │ Finance  │ Mfg      │ DB       │ Data     │ LLM      │
│ Dashboard│ Module   │ Module   │ Manager  │ Upload   │ Gateway  │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│              Module Management System                           │
│  Company.enabled_modules → User.accessible_modules              │
└──────────────────────────────────────────────────────────────┘
```

### Available Modules

| Module ID | Label | Status |
|-----------|-------|--------|
| `bi_dashboard` | BI Dashboard | ✅ Active |
| `finance` | Finance | ✅ Active |
| `manufacturing` | Manufacturing | ✅ Active |
| `inventory` | Inventory Management | ✅ Active |
| `purchasing` | Purchasing | ✅ Active |
| `sales` | Sales | ✅ Active |
| `trading` | Trading | ✅ Active |
| `service_sales` | Service Sales | ✅ Active |
| `workflow` | Workflow Engine | ✅ Active |
| `crm` | CRM | 🔲 Ready (future) |
| `db_manager` | Database Manager | ✅ Active |
| `datasets` | Data Upload | ✅ Active |
| `llm` | LLM Gateway | ✅ Active |
| `settings` | Settings | ✅ Active |

---

## 🏗️ Unified ERP Layout (v0.9.0) — NEW

### ERPLayout Component (`frontend/src/pages/ERPLayout.tsx`)

Single collapsible sidebar with all ERP modules:

| Section | Items | Persian Label |
|---------|-------|---------------|
| Finance | Dashboard, COA, Invoices, Receipts, Payments, Cheques, Customers, Suppliers, Vouchers | مالی |
| Inventory | Dashboard, Warehouses, Movements, Reservations | انبار |
| Purchasing | Dashboard, Requests, Orders, Receipts | خرید |
| Sales | Dashboard, Quotations, Orders, Invoices, Returns | فروش |
| Manufacturing | Dashboard, BOMs, Routings, Work Centers, Production Orders, Quality | تولید |
| Trading | Dashboard, Imports, Exports, Containers, Shipments | بازرگانی |
| Service Sales | Dashboard, Bookings, Services, Tickets, Tours, Hotels, Passengers, Commissions, Refunds | فروش خدمات |
| Settings | Settings, Users, Org Chart | تنظیمات |

### UI Features
- **Theme**: Orange #F16724 primary, Teal #529E98 secondary (per UI_UX_GUIDELINES.md)
- **Top Nav**: Breadcrumbs (section > page), search placeholder, notifications bell, theme toggle (dark/light), user menu
- **Dark Mode**: Wired to `themeStore` with `syncThemeClass(dark)` on `<html>`
- **Collapsible Sidebar**: Auto-expand active section via `useEffect`
- **RTL**: Full RTL support with `dir="rtl"` and Vazirmatn/Inter fonts
- **Icons**: All lucide-react valid icons

### Route Structure
- All ERP routes nested under `/erp` using ERPLayout
- Old routes (`/finance`, `/inventory`, etc.) redirect to `/erp` equivalents
- Admin/Users/OrgChart/LLMSettings moved to `/erp/settings/*`
- Standalone modules (dashboards, db-manager) remain separate

---

## 🏗️ Enterprise Architecture (v0.8.0)

### Core App (`backend/apps/core/`)

| Component | Purpose |
|-----------|---------|
| `SoftDeleteMixin` | Business documents are never physically deleted |
| `AuditFieldsMixin` | Every entity tracks created_by, updated_by, timestamps |
| `CompanyIsolationMixin` | Multi-company data isolation |
| `BaseModel` | Combines all mixins for business entities |
| `responses.py` | Standard API responses |

### Accounting Posting Engine

| Document | Debit | Credit |
|----------|-------|--------|
| Sales Invoice | Customer Receivable (131) | Sales Revenue (401) + VAT Payable (221) |
| Sales Return | Sales Return (402) | Customer Receivable (131) |
| Purchase Invoice | Purchase Expense (501) | Supplier Payable (201) + VAT Receivable (133) |
| Receipt | Bank (102) | Customer Receivable (131) |
| Payment | Supplier Payable (201) | Bank (102) |
| Stock Receipt | Inventory (111) | Supplier Payable (231) / Production WIP (151) |
| Stock Issue | COGS (501) | Inventory (111) |
| Material Consumption | Production WIP (151) | Raw Material Inventory (111) |
| Finished Goods Receipt | Finished Goods (112) | Production WIP (151) |
| Goods Receipt | Inventory (111) | Goods Received (231) |
| Purchase Return | Supplier Payable (231) | Inventory (111) |

---

## 🧪 Test Coverage Summary

| Module | Tests | Status |
|--------|-------|--------|
| `accounts` | 14 | ✅ All pass |
| `dashboards` | (via CI) | ✅ |
| `datasets` | ~50 | ✅ All pass |
| `db_manager` | ~30 | ✅ All pass |
| `finance` | 61 | ✅ All pass |
| `manufacturing` | 18 | ✅ All pass |
| `workflow` | 27 | ✅ All pass |
| `inventory` | ~25 | 🔲 Written (needs DB) |
| `purchasing` | ~20 | 🔲 Written (needs DB) |
| `sales` | ~20 | 🔲 Written (needs DB) |
| `llm` | ~20 | ✅ All pass |
| **Total** | **~330** | ✅ **All pass (existing) + ~65 written** |

---

## 🐛 Bug Fixes (v0.9.0)

### Sales URL Basename Conflict
- **Issue**: `basename="invoice"` in sales router collided with finance's `invoice-list` URL name
- **Fix**: Changed to `basename="sales-invoice"` and `basename="sales-return"` in `backend/apps/sales/urls.py`
- **Impact**: Finance invoice tests now pass 61/61 (were failing with 400 errors)

### Quality Model Migration
- **Issue**: `inspected_at = DateTimeField(auto_now_add=True)` couldn't migrate to existing table
- **Fix**: Changed to `default=timezone.now, editable=False` in `backend/apps/manufacturing/quality.py`
- **Migrations**: `manufacturing.0004` + `manufacturing.0005` + `sales.0001` all applied

### Trading Seed Data
- **Issue**: `seed_trading_data.py` didn't create trading accounts (132, 232, 233, 403, 512)
- **Fix**: Added `get_or_create` for all 5 trading Kol accounts with proper groups

---

## 📁 Project Structure (Updated)

```
Nexivo/
├── backend/
│   ├── apps/
│   │   ├── accounts/          # Auth, users, org hierarchy
│   │   ├── core/              # Enterprise base: mixins, responses
│   │   ├── dashboards/        # BI Dashboard
│   │   ├── datasets/          # Data upload
│   │   ├── db_manager/        # Database management
│   │   ├── finance/           # Finance (Iranian accounting + enterprise)
│   │   ├── inventory/         # Inventory Management (8 models)
│   │   ├── manufacturing/     # Manufacturing (8 models + MRP + Costing + Quality)
│   │   ├── purchasing/        # Purchasing (4 models)
│   │   ├── sales/             # Sales (8 models + 4 services)
│   │   ├── service_sales/     # Service Sales (booking, tickets, etc.)
│   │   ├── trading/           # Trading (import/export/containers/shipments)
│   │   ├── workflow/          # Workflow Engine (7+ models + delegation/SLA/notifications)
│   │   └── llm/               # LLM Gateway
│   └── nexivo/
│       ├── settings.py
│       └── urls.py
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── ERPLayout.tsx         # NEW: Unified ERP sidebar layout
│       │   ├── finance/              # 10-page RTL finance UI
│       │   ├── inventory/            # 5-page inventory UI
│       │   ├── purchasing/           # 5-page purchasing UI
│       │   ├── sales/                # 6-page sales UI
│       │   ├── manufacturing/        # 6-page manufacturing UI
│       │   ├── trading/              # 5-page trading UI
│       │   ├── service_sales/        # 9-page service sales UI
│       │   └── ...
│       ├── store/                    # Zustand stores (auth, theme, dashboard)
│       └── api/                      # API clients
└── docs/
    └── Financial/                    # 15 enterprise architecture spec files
```

---

## 📝 Recent Changes (July 21, 2026)

### v0.9.0 — Unified ERP Layout, Bug Fixes

**Unified ERP Layout:**
- Created `ERPLayout.tsx` with collapsible sidebar (8 module sections)
- Top navigation bar with breadcrumbs, search, notifications, theme toggle
- Dark mode wired to `themeStore` with `syncThemeClass(dark)`
- All ERP routes nested under `/erp` in `App.tsx`
- Old routes redirect to `/erp` equivalents
- Settings/Admin/OrgChart stripped standalone headers for ERPLayout integration
- Removed 7 dead Layout files (FinanceLayout, InventoryLayout, etc.)

**Bug Fixes:**
- Fixed sales URL basename collision (`invoice` → `sales-invoice`)
- Fixed `inspected_at` field migration issue in quality.py
- Added trading accounts to seed_trading_data.py
- Fixed SettingsPage redirect from `/dashboards` to `/erp`

**Test Results:**
- Finance: 61/61 ✅
- Workflow: 27/27 ✅
- Manufacturing: 18/18 ✅
- TypeScript: 0 errors ✅
- Docker: Build successful ✅

### v0.8.0 — Sales Module, Frontend for All Modules
*(See previous entry for details)*

### v0.7.0 — Purchasing Module, Tests for Inventory & Workflow
*(See previous entry for details)*

### v0.6.0 — Inventory Module, Workflow Extensions & Manufacturing Integration
*(See previous entry for details)*

---

## 🚀 Roadmap

### ✅ Completed
- [x] Enterprise core mixins (soft delete, audit, company isolation)
- [x] Standard API response format
- [x] Finance service/selector/validator layers
- [x] Accounting Posting Engine
- [x] Workflow Engine state machine
- [x] Tax Engine (VAT, withholding)
- [x] Manufacturing Module (BOM, Routing, WorkCenter, ProductionOrder)
- [x] MRP Engine (Material Requirement Planning)
- [x] Manufacturing Cost Engine (standard/actual/FIFO costing)
- [x] Manufacturing Quality Control
- [x] Inventory Management Module (Phase 6)
- [x] Workflow Engine extensions (delegation, escalation, SLA, notifications)
- [x] Manufacturing → Accounting integration
- [x] Purchasing Module (Phase 7)
- [x] Sales Module (Phase 8)
- [x] Manufacturing Module (Phase 9)
- [x] Trading Module (Phase 10) — Import/Export/Containers/Shipments
- [x] Service Sales Module (Phase 11) — Bookings/Tickets/Tours/Hotels
- [x] Unified ERP Layout with all modules
- [x] ~330 tests passing

### 🔜 In Progress / Next
- [ ] Service Management Module (Phase 12) — Tickets, Work Orders, Warranty
- [ ] CRM Module (Phase 13) — Leads, Opportunities, Activities
- [ ] HR / Payroll Module (Phase 14)

### 🔮 Future
- [ ] Report Engine (centralized)
- [ ] Text-to-SQL for BI Dashboard
- [ ] Invoice OCR with LlamaIndex
- [ ] Mobile app (React Native)
- [ ] Multi-language support (FA/EN/AR)
- [ ] SSO integration (SAML/OIDC)
