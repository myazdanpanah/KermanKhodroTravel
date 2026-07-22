# PROGRESS.md — Nexivo ERP

## v0.13.0 — Login Fix, Report Queries, Production Docker, Phase 16 AI Integration

### Bug Fixes
- **Login 401 fix:** Database was empty after Docker rebuild. Seeded dev users (admin/admin12345, ceo/ceo123456, finance/finance123, sales/sales12345)
- **React useContext crash (P0):** Added `target: dev` to docker-compose.yml frontend service. Without it, Docker built the production stage (nginx with stale static files) instead of the Vite dev server
- **NLQueryPage useEffect fix:** Changed `useState(() => fetchHistory())` to `useEffect(() => fetchHistory(), [])`
- **Anomaly detection duplicates:** Added `filter().exists()` guard in both finance and sales anomaly detection to prevent creating duplicate anomalies on re-run
- **Sales anomaly filter fix:** Corrected module filter from `'finance'` to `'sales'` in `detect_sales_anomalies`

### Report Queries Added
- **Manufacturing:** ProductionOrder status/count/cost aggregation, WorkCenter and BOM counts
- **Trading:** ImportOrder/ExportOrder status/value aggregation, Shipment counts
- **Service Management:** ServiceRequest status/priority breakdown, WorkOrder status, Technician/Contract counts

### Production Docker
- **docker-compose.prod.yml:** Production deployment config with frontend production build (nginx), backend, celery, postgres, redis
- **Simplified architecture:** Frontend container serves built static files directly via nginx (no separate nginx container)

### Phase 16: AI Integration

#### Backend (apps/ai_insights)
- **Models:** AIInsight, AnomalyDetection, Forecast, NLQuery (4 models)
- **Services:**
  - `InsightService` — list/read/dismiss/summary
  - `AnomalyService` — Z-score anomaly detection for finance & sales, duplicate prevention
  - `ForecastService` — Linear regression forecasting with confidence intervals, R² accuracy
  - `NLQueryService` — Keyword-based module detection, module-level data queries
- **API:** 13 endpoints at /api/v1/ai/ (dashboard, insights, anomalies, forecasts, NL queries)
- **Serializers:** 5 serializers for all models + NLQueryCreate
- **Admin:** All 4 models registered
- **Migration:** 0001_initial applied

#### Frontend (pages/ai-insights)
- **AIDashboardPage:** Stat cards, anomaly by module, recent queries
- **AnomaliesPage:** Detect/resolve/filter anomalies by module and severity
- **ForecastsPage:** Generate forecasts, view forecast data tables, accuracy scores
- **NLQueryPage:** Natural language query input with quick suggestions, result tables, query history

#### Registration
- Added `ai_insights` to MODULE_CHOICES, ALL_ERP_MODULES, INSTALLED_APPS, NAV_SECTIONS sidebar

### Validation Results
- TypeScript: 0 errors
- Tests: 167/167 passing (Finance + Workflow + Reporting + Service Management + CRM + HR + AI Insights)
- Git: 24+ commits this session

### Module Coverage (17 modules)
1. Finance
2. Inventory
3. Purchasing
4. Sales
5. Manufacturing
6. Trading
7. Service Sales
8. Service Management
9. CRM
10. HR
11. Reporting & Analytics
12. AI Insights ← NEW
13. Settings
14. BI Dashboard
15. Database Manager
16. Data Upload
17. Workflow Engine

---

## Previous Phases
- v0.12.0: Phases 12-15 (Service Management, CRM, HR, Reporting Engine)
- v0.11.0: Phases 8-11 (Manufacturing, Trading, Service Sales, Workflow Extensions)
- v0.10.0: Phases 1-7 (Foundation, Finance, Inventory, Purchasing, Sales, MRP, Cost Engine)

---

## Next Phases
- Phase 17: Mobile App (React Native)
- Phase 18: Multi-tenant Architecture
- Phase 19: Advanced NL Query (LLM-powered natural language to SQL)
- Phase 20: Real-time Anomaly Alerts (WebSocket notifications)
