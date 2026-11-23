import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useBrandLogo } from './store/brandingStore'

// ── Eagerly loaded shell pages ─────────────────────────────────
import LoginPage from './pages/LoginPage'
import LauncherPage from './pages/LauncherPage'
import ERPLayout from './pages/ERPLayout'

// ── Route-level code splitting ─────────────────────────────────
// Every page below is loaded on demand so the initial bundle stays small.
// Finance module
const BillingDashboardPage = lazy(() => import('./pages/billing/BillingDashboardPage'))
const BillingIssuePage = lazy(() => import('./pages/billing/BillingIssuePage'))
const BillingInvoicesPage = lazy(() => import('./pages/billing/BillingInvoicesPage'))
const BillingPaymentsPage = lazy(() => import('./pages/billing/BillingPaymentsPage'))
const BillingPerformancePage = lazy(() => import('./pages/billing/BillingPerformancePage'))
const BillingPayersPage = lazy(() => import('./pages/billing/BillingPayersPage'))
const BillingServicesPage = lazy(() => import('./pages/billing/BillingServicesPage'))
const ChartOfAccountsPage = lazy(() => import('./pages/finance/ChartOfAccountsPage'))
const InvoicesPage = lazy(() => import('./pages/finance/InvoicesPage'))
const ReceiptsPage = lazy(() => import('./pages/finance/ReceiptsPage'))
const PaymentsPage = lazy(() => import('./pages/finance/PaymentsPage'))
const ChequesPage = lazy(() => import('./pages/finance/ChequesPage'))
const CustomersPage = lazy(() => import('./pages/finance/CustomersPage'))
const SuppliersPage = lazy(() => import('./pages/finance/SuppliersPage'))
const VouchersPage = lazy(() => import('./pages/finance/VouchersPage'))
// Inventory module
const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard'))
const WarehousesPage = lazy(() => import('./pages/inventory/WarehousesPage'))
const StockMovementsPage = lazy(() => import('./pages/inventory/StockMovementsPage'))
const ReservationsPage = lazy(() => import('./pages/inventory/ReservationsPage'))
// Purchasing module
const PurchasingDashboard = lazy(() => import('./pages/purchasing/PurchasingDashboard'))
const PurchaseOrdersPage = lazy(() => import('./pages/purchasing/PurchaseOrdersPage'))
const PurchaseRequestsPage = lazy(() => import('./pages/purchasing/PurchaseRequestsPage'))
const GoodsReceiptsPage = lazy(() => import('./pages/purchasing/GoodsReceiptsPage'))
// Sales module
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard'))
const SalesOrdersPage = lazy(() => import('./pages/sales/SalesOrdersPage'))
const SalesInvoicesPage = lazy(() => import('./pages/sales/SalesInvoicesPage'))
const SalesReturnsPage = lazy(() => import('./pages/sales/SalesReturnsPage'))
const SalesQuotationsPage = lazy(() => import('./pages/sales/SalesQuotationsPage'))
// Manufacturing module
const ManufacturingDashboard = lazy(() => import('./pages/manufacturing/ManufacturingDashboard'))
const ProductionOrdersPage = lazy(() => import('./pages/manufacturing/ProductionOrdersPage'))
const BOMsPage = lazy(() => import('./pages/manufacturing/BOMsPage'))
const QualityControlPage = lazy(() => import('./pages/manufacturing/QualityControlPage'))
const RoutingsPage = lazy(() => import('./pages/manufacturing/RoutingsPage'))
const WorkCentersPage = lazy(() => import('./pages/manufacturing/WorkCentersPage'))
// Trading module
const TradingDashboard = lazy(() => import('./pages/trading/TradingDashboard'))
const ImportsPage = lazy(() => import('./pages/trading/ImportsPage'))
const ExportsPage = lazy(() => import('./pages/trading/ExportsPage'))
const ContainersPage = lazy(() => import('./pages/trading/ContainersPage'))
const ShipmentsPage = lazy(() => import('./pages/trading/ShipmentsPage'))
// Service Management module
const ServiceManagementDashboard = lazy(() => import('./pages/service-management/ServiceManagementDashboard'))
const ServiceRequestsPage = lazy(() => import('./pages/service-management/ServiceRequestsPage'))
const ServiceRequestDetailPage = lazy(() => import('./pages/service-management/ServiceRequestDetailPage'))
const WorkOrdersPage = lazy(() => import('./pages/service-management/WorkOrdersPage'))
const WorkOrderDetailPage = lazy(() => import('./pages/service-management/WorkOrderDetailPage'))
const TechniciansPage = lazy(() => import('./pages/service-management/TechniciansPage'))
const ContractsPage = lazy(() => import('./pages/service-management/ContractsPage'))
const WarrantiesPage = lazy(() => import('./pages/service-management/WarrantiesPage'))
const SLAPage = lazy(() => import('./pages/service-management/SLAPage'))
const MaintenancePage = lazy(() => import('./pages/service-management/MaintenancePage'))
// HR module
const HRDashboard = lazy(() => import('./pages/hr/HRDashboard'))
const EmployeesPage = lazy(() => import('./pages/hr/EmployeesPage'))
const AttendancePage = lazy(() => import('./pages/hr/AttendancePage'))
const DepartmentsPage = lazy(() => import('./pages/hr/DepartmentsPage'))
const LeavePage = lazy(() => import('./pages/hr/LeavePage'))
const PayrollPage = lazy(() => import('./pages/hr/PayrollPage'))
const EvaluationsPage = lazy(() => import('./pages/hr/EvaluationsPage'))
const RecruitmentPage = lazy(() => import('./pages/hr/RecruitmentPage'))
const LeaveTypesPage = lazy(() => import('./pages/hr/LeaveTypesPage'))
// CRM module
const CRMPage = lazy(() => import('./pages/crm/CRMPage'))
const LeadsPage = lazy(() => import('./pages/crm/LeadsPage'))
const OpportunitiesPage = lazy(() => import('./pages/crm/OpportunitiesPage'))
const ActivitiesPage = lazy(() => import('./pages/crm/ActivitiesPage'))
const CampaignsPage = lazy(() => import('./pages/crm/CampaignsPage'))
const OfficeWorkbenchPage = lazy(() => import('./pages/office/WorkbenchPage'))
const OfficeLettersPage = lazy(() => import('./pages/office/CorrespondenceListPage'))
const OfficeCorrespondencePage = lazy(() => import('./pages/office/CorrespondenceDetailPage'))
const OfficeContractsPage = lazy(() => import('./pages/office/ContractsPage'))
const UserSettingsPage = lazy(() => import('./pages/UserSettingsPage'))
const ManagementDashboardPage = lazy(() => import('./pages/ManagementDashboardPage'))
const SmsPage = lazy(() => import('./pages/crm/SmsPage'))
// Reporting module
const ReportsPage = lazy(() => import('./pages/reporting/ReportsPage'))
const DashboardsPage = lazy(() => import('./pages/reporting/DashboardsPage'))
const DashboardViewerPage = lazy(() => import('./pages/reporting/DashboardViewerPage'))
const KPIsPage = lazy(() => import('./pages/reporting/KPIsPage'))
const ScheduledReportsPage = lazy(() => import('./pages/reporting/ScheduledReportsPage'))
// Service Sales module
const ServiceSalesDashboard = lazy(() => import('./pages/service_sales/ServiceSalesDashboard'))
const BookingsPage = lazy(() => import('./pages/service_sales/BookingsPage'))
const ServicesPage = lazy(() => import('./pages/service_sales/ServicesPage'))
const TicketsPage = lazy(() => import('./pages/service_sales/TicketsPage'))
const ToursPage = lazy(() => import('./pages/service_sales/ToursPage'))
const HotelsPage = lazy(() => import('./pages/service_sales/HotelsPage'))
const PassengersPage = lazy(() => import('./pages/service_sales/PassengersPage'))
const CommissionsPage = lazy(() => import('./pages/service_sales/CommissionsPage'))
const RefundsPage = lazy(() => import('./pages/service_sales/RefundsPage'))
// Settings (inside ERP)
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SSOSettingsPage = lazy(() => import('./pages/settings/SSOSettingsPage'))
// Audit Log
const AuditLogPage = lazy(() => import('./pages/audit/AuditLogPage'))
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'))
const OrgChartPage = lazy(() => import('./pages/OrgChartPage'))
// Other standalone pages
const DashboardListPage = lazy(() => import('./pages/DashboardListPage'))
const DashboardBuilderPage = lazy(() => import('./pages/DashboardBuilderPage'))
const DashboardAssignPage = lazy(() => import('./pages/DashboardAssignPage'))
const DataUploadPage = lazy(() => import('./pages/DataUploadPage'))
const DatabaseManagerPage = lazy(() => import('./pages/DatabaseManagerPage'))
const TableEditorPage = lazy(() => import('./pages/TableEditorPage'))
const SchemaEditorPage = lazy(() => import('./pages/SchemaEditorPage'))
const SqlEditorPage = lazy(() => import('./pages/SqlEditorPage'))
const FileImportPage = lazy(() => import('./pages/FileImportPage'))
const ExternalDbPage = lazy(() => import('./pages/ExternalDbPage'))
const SheetsSyncPage = lazy(() => import('./pages/SheetsSyncPage'))
const SupersetHealthPage = lazy(() => import('./pages/SupersetHealthPage'))
const LLMSettingsPage = lazy(() => import('./pages/LLMSettingsPage'))
const RoadmapPage = lazy(() => import('./pages/RoadmapPage'))
// AI Insights module
const AIDashboardPage = lazy(() => import('./pages/ai-insights/AIDashboardPage'))
const AnomaliesPage = lazy(() => import('./pages/ai-insights/AnomaliesPage'))
const ForecastsPage = lazy(() => import('./pages/ai-insights/ForecastsPage'))
const NLQueryPage = lazy(() => import('./pages/ai-insights/NLQueryPage'))
// Messaging module (Nexivo Orbit)
const OrbitLayout = lazy(() => import('./pages/messaging/OrbitLayout'))
// Analytics
const AdvancedAnalyticsPage = lazy(() => import('./pages/analytics/AdvancedAnalyticsPage'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function PageFallback() {
  // Always the tenant's own logo, including while a sub-page lazy-loads.
  const logo = useBrandLogo()
  return (
    <div className="flex h-96 items-center justify-center">
      <img
        src={logo}
        alt=""
        draggable={false}
        className="nx-splash-mark h-16 w-auto select-none opacity-80"
      />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Launcher — the splash page after login */}
        <Route path="/launcher" element={<PrivateRoute><LauncherPage /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><LauncherPage /></PrivateRoute>} />

        {/* ═══ Unified ERP Layout ═══ */}
        <Route path="/erp" element={<PrivateRoute><ERPLayout /></PrivateRoute>}>
          {/* Management Dashboard (ERP Overview) */}
          <Route index element={<ManagementDashboardPage />} />
          <Route path="management" element={<ManagementDashboardPage />} />

          {/* Finance (Billing) */}
          <Route path="billing" element={<BillingDashboardPage />} />
          <Route path="billing/issue" element={<BillingIssuePage />} />
          <Route path="billing/invoices" element={<BillingInvoicesPage />} />
          <Route path="billing/payments" element={<BillingPaymentsPage />} />
          <Route path="billing/performance" element={<BillingPerformancePage />} />
          <Route path="billing/payers" element={<BillingPayersPage />} />
          <Route path="billing/services" element={<BillingServicesPage />} />
          <Route path="chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="cheques" element={<ChequesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="vouchers" element={<VouchersPage />} />
          {/* Inventory */}
          <Route path="inventory" element={<InventoryDashboard />} />
          <Route path="inventory/warehouses" element={<WarehousesPage />} />
          <Route path="inventory/movements" element={<StockMovementsPage />} />
          <Route path="inventory/reservations" element={<ReservationsPage />} />
          {/* Purchasing */}
          <Route path="purchasing" element={<PurchasingDashboard />} />
          <Route path="purchasing/requests" element={<PurchaseRequestsPage />} />
          <Route path="purchasing/orders" element={<PurchaseOrdersPage />} />
          <Route path="purchasing/receipts" element={<GoodsReceiptsPage />} />
          {/* Sales */}
          <Route path="sales" element={<SalesDashboard />} />
          <Route path="sales/quotations" element={<SalesQuotationsPage />} />
          <Route path="sales/orders" element={<SalesOrdersPage />} />
          <Route path="sales/invoices" element={<SalesInvoicesPage />} />
          <Route path="sales/returns" element={<SalesReturnsPage />} />
          {/* Manufacturing */}
          <Route path="manufacturing" element={<ManufacturingDashboard />} />
          <Route path="manufacturing/boms" element={<BOMsPage />} />
          <Route path="manufacturing/routings" element={<RoutingsPage />} />
          <Route path="manufacturing/work-centers" element={<WorkCentersPage />} />
          <Route path="manufacturing/production-orders" element={<ProductionOrdersPage />} />
          <Route path="manufacturing/quality" element={<QualityControlPage />} />
          {/* Trading */}
          <Route path="trading" element={<TradingDashboard />} />
          <Route path="trading/imports" element={<ImportsPage />} />
          <Route path="trading/exports" element={<ExportsPage />} />
          <Route path="trading/containers" element={<ContainersPage />} />
          <Route path="trading/shipments" element={<ShipmentsPage />} />
          {/* Service Sales */}
          <Route path="service-sales" element={<ServiceSalesDashboard />} />
          <Route path="service-sales/bookings" element={<BookingsPage />} />
          <Route path="service-sales/services" element={<ServicesPage />} />
          <Route path="service-sales/tickets" element={<TicketsPage />} />
          <Route path="service-sales/tours" element={<ToursPage />} />
          <Route path="service-sales/hotels" element={<HotelsPage />} />
          <Route path="service-sales/passengers" element={<PassengersPage />} />
          <Route path="service-sales/commissions" element={<CommissionsPage />} />
          <Route path="service-sales/refunds" element={<RefundsPage />} />
          {/* Service Management */}
          <Route path="service-management" element={<ServiceManagementDashboard />} />
          <Route path="service-management/dashboard" element={<ServiceManagementDashboard />} />
          <Route path="service-management/requests" element={<ServiceRequestsPage />} />
          <Route path="service-management/requests/new" element={<ServiceRequestsPage />} />
          <Route path="service-management/requests/:id" element={<ServiceRequestDetailPage />} />
          <Route path="service-management/work-orders" element={<WorkOrdersPage />} />
          <Route path="service-management/work-orders/new" element={<WorkOrdersPage />} />
          <Route path="service-management/work-orders/:id" element={<WorkOrderDetailPage />} />
          <Route path="service-management/technicians" element={<TechniciansPage />} />
          <Route path="service-management/contracts" element={<ContractsPage />} />
          <Route path="service-management/warranties" element={<WarrantiesPage />} />
          <Route path="service-management/sla" element={<SLAPage />} />
          <Route path="service-management/maintenance" element={<MaintenancePage />} />
          {/* CRM */}
          <Route path="crm" element={<CRMPage />} />
          <Route path="crm/leads" element={<LeadsPage />} />
          <Route path="crm/opportunities" element={<OpportunitiesPage />} />
          <Route path="crm/activities" element={<ActivitiesPage />} />
          <Route path="crm/campaigns" element={<CampaignsPage />} />
          {/* Office */}
          <Route path="office" element={<OfficeWorkbenchPage />} />
          <Route path="office/correspondence" element={<OfficeLettersPage />} />
          <Route path="office/correspondence/:id" element={<OfficeCorrespondencePage />} />
          <Route path="office/contracts" element={<OfficeContractsPage />} />
          <Route path="profile" element={<UserSettingsPage />} />
          <Route path="management" element={<ManagementDashboardPage />} />
          <Route path="crm/sms" element={<SmsPage />} />
          {/* HR */}
          <Route path="hr" element={<HRDashboard />} />
          <Route path="hr/employees" element={<EmployeesPage />} />
          <Route path="hr/attendance" element={<AttendancePage />} />
          <Route path="hr/departments" element={<DepartmentsPage />} />
          <Route path="hr/leave" element={<LeavePage />} />
          <Route path="hr/payroll" element={<PayrollPage />} />
          <Route path="hr/evaluations" element={<EvaluationsPage />} />
          <Route path="hr/leave-types" element={<LeaveTypesPage />} />
          <Route path="hr/recruitment" element={<RecruitmentPage />} />
          {/* Reporting & Analytics */}
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/dashboards" element={<DashboardsPage />} />
          <Route path="reports/dashboards/:id" element={<DashboardViewerPage />} />
          <Route path="reports/kpis" element={<KPIsPage />} />
          <Route path="reports/scheduled" element={<ScheduledReportsPage />} />
          {/* AI Insights */}
          <Route path="ai" element={<AIDashboardPage />} />
          <Route path="ai/anomalies" element={<AnomaliesPage />} />
          <Route path="ai/forecasts" element={<ForecastsPage />} />
          <Route path="ai/nl-query" element={<NLQueryPage />} />
          {/* Advanced Analytics */}
          <Route path="analytics" element={<AdvancedAnalyticsPage />} />
          {/* Notifications */}
          <Route path="notifications" element={<NotificationsPage />} />
          {/* Messaging (Nexivo Orbit) redirect to standalone */}
          <Route path="messages" element={<Navigate to="/orbit" replace />} />
          <Route path="messages/:conversationId" element={<Navigate to="/orbit" replace />} />
          {/* Settings */}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/:tab" element={<SettingsPage />} />
          <Route path="settings/users" element={<AdminSettingsPage />} />
          <Route path="settings/org" element={<OrgChartPage />} />
          <Route path="settings/ai" element={<LLMSettingsPage />} />
          <Route path="settings/sso" element={<SSOSettingsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
        </Route>

        {/* ═══ Redirects from old routes to unified ERP ═══ */}
        <Route path="/finance" element={<Navigate to="/erp" replace />} />
        {/* Inventory redirects */}
        <Route path="/inventory" element={<Navigate to="/erp/inventory" replace />} />
        {/* Purchasing redirects */}
        <Route path="/purchasing" element={<Navigate to="/erp/purchasing" replace />} />
        {/* Sales redirects */}
        <Route path="/sales" element={<Navigate to="/erp/sales" replace />} />
        {/* Manufacturing redirects */}
        <Route path="/manufacturing" element={<Navigate to="/erp/manufacturing" replace />} />
        {/* Trading redirects */}
        <Route path="/trading" element={<Navigate to="/erp/trading" replace />} />
        {/* Service Sales redirects */}
        <Route path="/service-sales" element={<Navigate to="/erp/service-sales" replace />} />
        {/* Settings redirects */}
        <Route path="/settings" element={<Navigate to="/erp/settings" replace />} />
        <Route path="/admin/users" element={<Navigate to="/erp/settings/users" replace />} />
        <Route path="/org-chart" element={<Navigate to="/erp/settings/org" replace />} />

        {/* ═══ Standalone modules ═══ */}
        <Route path="/orbit" element={<PrivateRoute><OrbitLayout /></PrivateRoute>} />
        <Route path="/orbit/:conversationId" element={<PrivateRoute><OrbitLayout /></PrivateRoute>} />
        <Route path="/messages" element={<Navigate to="/orbit" replace />} />
        <Route path="/messages/:conversationId" element={<Navigate to="/orbit" replace />} />
        <Route path="/dashboards" element={<PrivateRoute><DashboardListPage /></PrivateRoute>} />
        <Route path="/dashboards/:id" element={<PrivateRoute><DashboardBuilderPage /></PrivateRoute>} />
        <Route path="/admin/assignments" element={<PrivateRoute><DashboardAssignPage /></PrivateRoute>} />
        <Route path="/data/upload" element={<PrivateRoute><DataUploadPage /></PrivateRoute>} />
        <Route path="/db-manager" element={<PrivateRoute><DatabaseManagerPage /></PrivateRoute>} />
        <Route path="/db-manager/table/:source/:table" element={<PrivateRoute><TableEditorPage /></PrivateRoute>} />
        <Route path="/db-manager/table/:source/:table/schema" element={<PrivateRoute><SchemaEditorPage /></PrivateRoute>} />
        <Route path="/db-manager/table/:source/:table/import" element={<PrivateRoute><FileImportPage /></PrivateRoute>} />
        <Route path="/db-manager/sql" element={<PrivateRoute><SqlEditorPage /></PrivateRoute>} />
        <Route path="/db-manager/syncs" element={<PrivateRoute><SheetsSyncPage /></PrivateRoute>} />
        <Route path="/db-manager/connections" element={<PrivateRoute><ExternalDbPage /></PrivateRoute>} />
        <Route path="/admin/superset" element={<PrivateRoute><SupersetHealthPage /></PrivateRoute>} />
        <Route path="/roadmap" element={<PrivateRoute><RoadmapPage /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
