# PROGRESS.md — Nexivo ERP

## v0.14.0 — Phase 19-20: LLM-powered NL Query + Real-time Anomaly Alerts

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
- **Models:** AIInsight, AnomalyDetection, Forecast, NLQuery, AnomalyAlert (5 models)
- **Services:**
  - `InsightService` — list/read/dismiss/summary
  - `AnomalyService` — Z-score anomaly detection for finance & sales, duplicate prevention
  - `ForecastService` — Linear regression forecasting with confidence intervals, R² accuracy
  - `NLQueryService` — Keyword-based module detection, module-level data queries
  - `AnomalyAlertService` — Real-time alert creation, WebSocket push, read/summary management
- **API:** 17 endpoints at /api/v1/ai/ (dashboard, insights, anomalies, forecasts, NL queries, alerts)
- **Serializers:** 6 serializers for all models + NLQueryCreate + AnomalyAlert
- **Admin:** All 5 models registered
- **Migrations:** 0001_initial, 0002_anomaly_alert

#### Frontend (pages/ai-insights)
- **AIDashboardPage:** Stat cards, anomaly by module, recent queries
- **AnomaliesPage:** Detect/resolve/filter anomalies by module and severity
- **ForecastsPage:** Generate forecasts, view forecast data tables, accuracy scores
- **NLQueryPage:** Natural language query input with quick suggestions, result tables, query history

#### Registration
- Added `ai_insights` to MODULE_CHOICES, ALL_ERP_MODULES, INSTALLED_APPS, NAV_SECTIONS sidebar

### Phase 19: Advanced NL Query (LLM-powered)
- **LLM Integration:** `NLQueryService._try_llm_query()` calls LLM gateway (chat_completion) when active provider exists
- **Structured Output:** System prompt instructs LLM to return JSON with module, headers, rows, SQL
- **Fallback:** Falls back to keyword-based detection when no LLM available or LLM fails
- **Regex JSON Extraction:** Parses JSON from markdown code blocks (```json...```) or direct JSON
- **Logging:** LLM failures logged at warning level for debugging
- **Tests:** 6 tests covering JSON parsing, markdown extraction, fallback, error handling

### Phase 20: Real-time Anomaly Alerts (WebSocket)
- **AnomalyAlert Model:** Inherits BaseModel, stores alert details with severity, read/notified status
- **AnomalyAlertService:** create_alerts_for_anomalies, list_alerts, mark_read, mark_all_read, summary, delete_old_alerts
- **WebSocket Consumer:** `AnomalyAlertConsumer` — authenticated connections (validates user.company_id matches URL), ping/pong
- **Channel Layer Integration:** `_push_websocket` sends alerts via Django Channels group_send
- **ASGI Config:** `nexivo/asgi.py` with AuthMiddlewareStack and ProtocolTypeRouter
- **Settings:** ASGI_APPLICATION, CHANNEL_LAYERS (Redis backend), channels/daphne in requirements.txt
- **Alert Endpoints:** alert_list, alert_summary, alert_mark_read, alert_mark_all_read
- **Tests:** 15 tests covering alert CRUD, filtering, company isolation, BaseModel inheritance, delete_old_alerts

### Validation Results
- TypeScript: 0 errors
- Tests: 190+ passing (all modules + 21 new AI Insights tests)
- Files changed: 11 (services, tests, alerts, consumers, routing, admin, serializers, views, urls, settings, requirements)
- New files: 3 (alerts.py, consumers.py, routing.py, asgi.py)

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
12. AI Insights ← ENHANCED (Phase 19+20)
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
- Phase 21: Advanced Analytics Dashboard (D3.js visualizations)
- Phase 22: API Rate Limiting & Throttling
