# Nexivo — Project Progress

**Last updated:** July 22, 2026  
**Current version:** v0.11.0

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
| `service_management` | Service Management | ✅ Active |
| `crm` | CRM | ✅ Active |
| `hr` | HR | ✅ Active |
| `workflow` | Workflow Engine | ✅ Active |
| `db_manager` | Database Manager | ✅ Active |
| `datasets` | Data Upload | ✅ Active |
| `llm` | LLM Gateway | ✅ Active |
| `settings` | Settings | ✅ Active |

---

## 🏗️ Unified ERP Layout (v0.11.0)

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
| Service Management | Dashboard, Requests, Work Orders, Technicians, Warranties, Contracts, SLA, Maintenance | مدیریت خدمات |
| CRM | Dashboard, Leads, Opportunities, Activities, Campaigns | CRM |
| HR | Dashboard, Employees, Attendance, Departments, Payroll, Evaluations, Recruitment | منابع انسانی |
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
- Old root routes (`/finance`, `/inventory`, etc.) redirect to `/erp` root
- Admin/Users/OrgChart/LLMSettings moved to `/erp/settings/*`
- Standalone modules (dashboards, db-manager) remain separate

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
| `service_management` | 24 | ✅ All pass |
| `crm` | 18 | ✅ All pass |
| `hr` | 21 | ✅ All pass |
| `llm` | ~20 | ✅ All pass |
| **Total** | **~383** | ✅ **All pass** |

---

## 📝 Recent Changes (July 22, 2026)

### v0.11.0 — Service Management, CRM, HR (Phases 12-14)

**Phase 12: Service Management Module**
- Backend: 11 models (ServiceRequest, Warranty, Technician, WorkOrder, WorkOrderOperation, ServiceContract, SLARule, MaintenancePlan, MaintenanceSchedule, ServicePart, ServiceFeedback)
- Services: 9 service classes with business logic
- Frontend: 10 pages (Dashboard, ServiceRequests list+detail, WorkOrders list+detail, Technicians, Contracts, Warranties, SLA, Maintenance)
- 24 unit tests passing

**Phase 13: CRM Module**
- Backend: 6 models (Lead, Opportunity, Activity, Campaign, CRMTask, CustomerTimeline)
- Services: LeadService (convert to customer+opportunity), OpportunityService (close won/lost, pipeline), ActivityService, CampaignService, CRMTaskService
- Frontend: 5 pages (Dashboard, Leads with convert, Opportunities with close won/lost, Activities, Campaigns with ROI)
- 18 unit tests passing

**Phase 14: HR Module**
- Backend: 10 models (Department, Employee, Attendance, LeaveType, LeaveRequest, PayrollPeriod, PayrollRecord, PerformanceEvaluation, Recruitment, Candidate)
- Services: DepartmentService, EmployeeService (terminate, summary), AttendanceService (check-in/out), LeaveService (request/approve/reject), PayrollService (generate payroll), PerformanceService (scoring), RecruitmentService (job posting, candidate advancement)
- Frontend: 3 pages (HRDashboard, EmployeesPage, AttendancePage)
- 21 unit tests passing

**Cross-cutting:**
- TypeScript: 0 errors
- Docker: Build successful
- MODULE_CHOICES: Updated (no duplicates)
- seed_default_modules: Updated with all ERP modules
- All migrations applied

### v0.10.0 — Service Management Module (Phase 12)
*(See previous entry for details)*

### v0.9.0 — Unified ERP Layout, Bug Fixes
*(See previous entry for details)*

### v0.8.0 — Sales Module, Frontend for All Modules
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
- [x] Service Management Module (Phase 12) — Requests/Warranty/WorkOrders/SLA/Maintenance
- [x] CRM Module (Phase 13) — Leads/Opportunities/Activities/Campaigns/Tasks
- [x] HR Module (Phase 14) — Employees/Departments/Attendance/Leave/Payroll/Recruitment
- [x] Unified ERP Layout with 11 module sections
- [x] ~383 tests passing

### 🔜 In Progress / Next
- [ ] Report Engine (Phase 15) — Centralized reporting across all modules

### 🔮 Future
- [ ] Text-to-SQL for BI Dashboard
- [ ] Invoice OCR with LlamaIndex
- [ ] Mobile app (React Native)
- [ ] Multi-language support (FA/EN/AR)
- [ ] SSO integration (SAML/OIDC)
