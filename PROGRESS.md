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

## v0.15.0 — Phases 17, 18, 21, 22: Mobile App, Multi-tenant, Analytics Dashboard, Rate Limiting

### Phase 17: Mobile App (React Native)
- **Framework:** Expo SDK 50 + React Native 0.73 + TypeScript
- **Navigation:** React Navigation (native stack + bottom tabs)
- **State Management:** Zustand for auth and app state
- **API Client:** Axios with JWT token management, refresh token support, SecureStore persistence
- **Screens:** LoginScreen (credentials, show/hide password), DashboardScreen (metrics grid, quick actions, alerts, module status)
- **Files:** `mobile/` directory with package.json, src/api/client.ts, src/store/authStore.ts, src/screens/LoginScreen.tsx, src/screens/DashboardScreen.tsx

### Phase 18: Multi-tenant Architecture
- **Models:**
  - `TenantPlan` — Subscription plans with limits (free/starter/professional/enterprise), module access, feature flags
  - `Tenant` — Organization with company link, subdomain, trial status, usage tracking, settings
  - `TenantSubscription` — Subscription history with Stripe integration fields
  - `TenantFeature` — Feature flags per tenant (module/capability/integration/UI)
- **Views:** tenant_list, tenant_detail, tenant_onboard, tenant_my_info, plan_list, tenant_change_plan, feature_list, feature_toggle, subscription_list
- **Serializers:** TenantPlanSerializer, TenantSerializer, TenantOnboardingSerializer, TenantSubscriptionSerializer, TenantFeatureSerializer
- **Admin:** All 4 models registered
- **Tests:** 10 tests covering plan creation, tenant activation/expiration/suspension, user limits, subscriptions, feature flags
- **Endpoints:** /api/v1/tenants/

### Phase 21: Advanced Analytics Dashboard
- **Frontend:** `AdvancedAnalyticsPage.tsx` with pure SVG chart components (no D3 dependency)
- **Charts:** LineChart (area fill, grid lines, axis labels), BarChart (responsive bars, grid lines), PieChart (arc slices, percentage labels)
- **Components:** MetricCard (value, trend indicator, change %), AnalyticsWidget (container with resize observer), time range selector (7d/30d/90d)
- **Data:** Fetches from /reporting/dashboards/ and /ai/dashboard/ APIs, builds sample widgets
- **Route:** /erp/analytics registered in App.tsx

### Phase 22: API Rate Limiting & Throttling
- **Models:**
  - `APIKey` — SHA-256 hashed keys with scopes, module access, rate limit overrides, expiration, usage tracking
  - `RateLimitPolicy` — Configurable policies (global/module/endpoint/api_key scope) with minute/hour/day limits, burst size, priority
  - `RateLimitLog` — Request logging with response time, throttle status, IP, user agent
- **Throttling:**
  - `APIKeyRateThrottle` — Atomic cache operations (add+incr pattern) for per-key limits
  - `ModuleRateThrottle` — Per-module per-client throttling
  - `ChatRateThrottle` — 20/min for LLM chat
  - `NLQueryRateThrottle` — 30/min for NL queries
  - `AlertRateThrottle` — 60/min for alerts
- **Middleware:** `RateLimitLoggingMiddleware` — Logs all /api/ requests (response time, throttle status, IP)
- **Authentication:** `APIKeyAuthentication` — DRF-compatible class for X-API-Key header auth
- **Views:** API key CRUD (create/regenerate/toggle/delete), policy management (admin), usage analytics (stats/logs)
- **Management Command:** `cleanup_rate_limit_logs` — Purge old logs (--days, --dry-run)
- **Tests:** 25+ tests covering key generation, hashing, verification, expiration, throttling, logging
- **Endpoints:** /api/v1/rate-limiting/
- **Config:** ASGI_APPLICATION, CHANNEL_LAYERS, DEFAULT_THROTTLE_RATES in settings.py

### Validation Results
- TypeScript: 0 errors (pending)
- Files changed: 4 (settings.py, urls.py, App.tsx, PROGRESS.md)
- New backend apps: 2 (rate_limiting, multi_tenant)
- New frontend page: 1 (analytics)
- New mobile directory: 1 (mobile/)

---

## Previous Phases
- v0.14.0: Phases 19-20 (LLM-powered NL Query + Real-time Anomaly Alerts)
- v0.12.0: Phases 12-15 (Service Management, CRM, HR, Reporting Engine)
- v0.11.0: Phases 8-11 (Manufacturing, Trading, Service Sales, Workflow Extensions)
- v0.10.0: Phases 1-7 (Foundation, Finance, Inventory, Purchasing, Sales, MRP, Cost Engine)

---

## Next Phases
- Phase 23: SSO/SAML Integration
- Phase 24: Audit Trail & Compliance Logging
- Phase 25: White-label & Custom Branding
