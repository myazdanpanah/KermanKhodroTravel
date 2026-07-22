import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import LauncherPage from './pages/LauncherPage'
import ERPLayout from './pages/ERPLayout'
// Finance module
import FinanceDashboard from './pages/finance/FinanceDashboard'
import ChartOfAccountsPage from './pages/finance/ChartOfAccountsPage'
import InvoicesPage from './pages/finance/InvoicesPage'
import ReceiptsPage from './pages/finance/ReceiptsPage'
import PaymentsPage from './pages/finance/PaymentsPage'
import ChequesPage from './pages/finance/ChequesPage'
import CustomersPage from './pages/finance/CustomersPage'
import SuppliersPage from './pages/finance/SuppliersPage'
import VouchersPage from './pages/finance/VouchersPage'
// Inventory module
import InventoryDashboard from './pages/inventory/InventoryDashboard'
import WarehousesPage from './pages/inventory/WarehousesPage'
import StockMovementsPage from './pages/inventory/StockMovementsPage'
import ReservationsPage from './pages/inventory/ReservationsPage'
// Purchasing module
import PurchasingDashboard from './pages/purchasing/PurchasingDashboard'
import PurchaseOrdersPage from './pages/purchasing/PurchaseOrdersPage'
import PurchaseRequestsPage from './pages/purchasing/PurchaseRequestsPage'
import GoodsReceiptsPage from './pages/purchasing/GoodsReceiptsPage'
// Sales module
import SalesDashboard from './pages/sales/SalesDashboard'
import SalesOrdersPage from './pages/sales/SalesOrdersPage'
import SalesInvoicesPage from './pages/sales/SalesInvoicesPage'
import SalesReturnsPage from './pages/sales/SalesReturnsPage'
import SalesQuotationsPage from './pages/sales/SalesQuotationsPage'
// Manufacturing module
import ManufacturingDashboard from './pages/manufacturing/ManufacturingDashboard'
import ProductionOrdersPage from './pages/manufacturing/ProductionOrdersPage'
import BOMsPage from './pages/manufacturing/BOMsPage'
import QualityControlPage from './pages/manufacturing/QualityControlPage'
import RoutingsPage from './pages/manufacturing/RoutingsPage'
import WorkCentersPage from './pages/manufacturing/WorkCentersPage'
// Trading module
import TradingDashboard from './pages/trading/TradingDashboard'
import ImportsPage from './pages/trading/ImportsPage'
import ExportsPage from './pages/trading/ExportsPage'
import ContainersPage from './pages/trading/ContainersPage'
import ShipmentsPage from './pages/trading/ShipmentsPage'
// Service Management module
import ServiceManagementDashboard from './pages/service-management/ServiceManagementDashboard'
import ServiceRequestsPage from './pages/service-management/ServiceRequestsPage'
import WorkOrdersPage from './pages/service-management/WorkOrdersPage'
import TechniciansPage from './pages/service-management/TechniciansPage'
import ContractsPage from './pages/service-management/ContractsPage'
import WarrantiesPage from './pages/service-management/WarrantiesPage'
import SLAPage from './pages/service-management/SLAPage'
import MaintenancePage from './pages/service-management/MaintenancePage'
// Service Sales module
import ServiceSalesDashboard from './pages/service_sales/ServiceSalesDashboard'
import BookingsPage from './pages/service_sales/BookingsPage'
import ServicesPage from './pages/service_sales/ServicesPage'
import TicketsPage from './pages/service_sales/TicketsPage'
import ToursPage from './pages/service_sales/ToursPage'
import HotelsPage from './pages/service_sales/HotelsPage'
import PassengersPage from './pages/service_sales/PassengersPage'
import CommissionsPage from './pages/service_sales/CommissionsPage'
import RefundsPage from './pages/service_sales/RefundsPage'
// Settings (inside ERP)
import SettingsPage from './pages/SettingsPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import OrgChartPage from './pages/OrgChartPage'
// Other standalone pages
import DashboardListPage from './pages/DashboardListPage'
import DashboardBuilderPage from './pages/DashboardBuilderPage'
import DashboardAssignPage from './pages/DashboardAssignPage'
import DataUploadPage from './pages/DataUploadPage'
import DatabaseManagerPage from './pages/DatabaseManagerPage'
import TableEditorPage from './pages/TableEditorPage'
import SchemaEditorPage from './pages/SchemaEditorPage'
import SqlEditorPage from './pages/SqlEditorPage'
import FileImportPage from './pages/FileImportPage'
import ExternalDbPage from './pages/ExternalDbPage'
import SheetsSyncPage from './pages/SheetsSyncPage'
import SupersetHealthPage from './pages/SupersetHealthPage'
import LLMSettingsPage from './pages/LLMSettingsPage'
import RoadmapPage from './pages/RoadmapPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Launcher — the splash page after login */}
      <Route path="/launcher" element={<PrivateRoute><LauncherPage /></PrivateRoute>} />
      <Route path="/" element={<PrivateRoute><LauncherPage /></PrivateRoute>} />

      {/* ═══ Unified ERP Layout ═══ */}
      <Route path="/erp" element={<PrivateRoute><ERPLayout /></PrivateRoute>}>
        {/* Finance */}
        <Route index element={<FinanceDashboard />} />
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
        <Route path="service-management/requests/:id" element={<ServiceRequestsPage />} />
        <Route path="service-management/work-orders" element={<WorkOrdersPage />} />
        <Route path="service-management/work-orders/new" element={<WorkOrdersPage />} />
        <Route path="service-management/work-orders/:id" element={<WorkOrdersPage />} />
        <Route path="service-management/technicians" element={<TechniciansPage />} />
        <Route path="service-management/contracts" element={<ContractsPage />} />
        <Route path="service-management/warranties" element={<WarrantiesPage />} />
        <Route path="service-management/sla" element={<SLAPage />} />
        <Route path="service-management/maintenance" element={<MaintenancePage />} />
        {/* Settings */}
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/:tab" element={<SettingsPage />} />
        <Route path="settings/users" element={<AdminSettingsPage />} />
        <Route path="settings/org" element={<OrgChartPage />} />
        <Route path="settings/ai" element={<LLMSettingsPage />} />
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
  )
}
