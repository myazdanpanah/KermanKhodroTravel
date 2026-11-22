# Nexivo target schema (PostgreSQL / Django)

Generated from the Django models. Use this when mapping SQL Server tables.

Total models: **185**

## Contents

- [accounts.Company](#accounts-company) — `accounts_company`
- [accounts.CompanyFont](#accounts-companyfont) — `accounts_companyfont`
- [accounts.CustomRole](#accounts-customrole) — `accounts_customrole`
- [accounts.Division](#accounts-division) — `accounts_division`
- [accounts.RoleFilter](#accounts-rolefilter) — `accounts_rolefilter`
- [accounts.Team](#accounts-team) — `accounts_team`
- [accounts.User](#accounts-user) — `accounts_user`
- [ai_insights.AIInsight](#ai_insights-aiinsight) — `ai_insights_aiinsight`
- [ai_insights.AnomalyAlert](#ai_insights-anomalyalert) — `ai_insights_anomalyalert`
- [ai_insights.AnomalyDetection](#ai_insights-anomalydetection) — `ai_insights_anomalydetection`
- [ai_insights.Forecast](#ai_insights-forecast) — `ai_insights_forecast`
- [ai_insights.NLQuery](#ai_insights-nlquery) — `ai_insights_nlquery`
- [audit_log.AuditLog](#audit_log-auditlog) — `audit_log_auditlog`
- [audit_log.AuditLogConfig](#audit_log-auditlogconfig) — `audit_log_auditlogconfig`
- [billing.ApprovalRequest](#billing-approvalrequest) — `billing_approvalrequest`
- [billing.AvailableLetterNumber](#billing-availableletternumber) — `billing_availableletternumber`
- [billing.BillingAuditEntry](#billing-billingauditentry) — `billing_billingauditentry`
- [billing.CompanySettings](#billing-companysettings) — `billing_companysettings`
- [billing.Credit](#billing-credit) — `billing_credit`
- [billing.FinalFile](#billing-finalfile) — `billing_finalfile`
- [billing.Invoice](#billing-invoice) — `billing_invoice`
- [billing.InvoiceTemplate](#billing-invoicetemplate) — `billing_invoicetemplate`
- [billing.LetterSequence](#billing-lettersequence) — `billing_lettersequence`
- [billing.ManualDebt](#billing-manualdebt) — `billing_manualdebt`
- [billing.Payer](#billing-payer) — `billing_payer`
- [billing.Payment](#billing-payment) — `billing_payment`
- [billing.ReportDesign](#billing-reportdesign) — `billing_reportdesign`
- [billing.ServiceCategory](#billing-servicecategory) — `billing_servicecategory`
- [crm.Activity](#crm-activity) — `crm_activity`
- [crm.CRMTask](#crm-crmtask) — `crm_crmtask`
- [crm.Campaign](#crm-campaign) — `crm_campaign`
- [crm.CustomerTimeline](#crm-customertimeline) — `crm_customertimeline`
- [crm.Lead](#crm-lead) — `crm_lead`
- [crm.Opportunity](#crm-opportunity) — `crm_opportunity`
- [crm.SmsMessage](#crm-smsmessage) — `crm_smsmessage`
- [crm.SmsSettings](#crm-smssettings) — `crm_smssettings`
- [dashboards.Dashboard](#dashboards-dashboard) — `dashboards_dashboard`
- [dashboards.DashboardAssignment](#dashboards-dashboardassignment) — `dashboards_dashboardassignment`
- [dashboards.DashboardPage](#dashboards-dashboardpage) — `dashboards_dashboardpage`
- [dashboards.Notification](#dashboards-notification) — `dashboards_notification`
- [dashboards.PermissionAuditLog](#dashboards-permissionauditlog) — `dashboards_permissionauditlog`
- [dashboards.Widget](#dashboards-widget) — `dashboards_widget`
- [datasets.DataFilter](#datasets-datafilter) — `datasets_datafilter`
- [datasets.Dataset](#datasets-dataset) — `datasets_dataset`
- [db_manager.DatabasePermission](#db_manager-databasepermission) — `db_manager_databasepermission`
- [db_manager.ExternalDatabase](#db_manager-externaldatabase) — `db_manager_externaldatabase`
- [db_manager.GoogleSheetsSync](#db_manager-googlesheetssync) — `db_manager_googlesheetssync`
- [finance.AccountGroup](#finance-accountgroup) — `finance_accountgroup`
- [finance.BankAccount](#finance-bankaccount) — `finance_bankaccount`
- [finance.Cheque](#finance-cheque) — `finance_cheque`
- [finance.Customer](#finance-customer) — `finance_customer`
- [finance.FiscalYear](#finance-fiscalyear) — `finance_fiscalyear`
- [finance.Invoice](#finance-invoice) — `finance_invoice`
- [finance.InvoiceItem](#finance-invoiceitem) — `finance_invoiceitem`
- [finance.JournalEntry](#finance-journalentry) — `finance_journalentry`
- [finance.JournalVoucher](#finance-journalvoucher) — `finance_journalvoucher`
- [finance.KolAccount](#finance-kolaccount) — `finance_kolaccount`
- [finance.MoinAccount](#finance-moinaccount) — `finance_moinaccount`
- [finance.Payment](#finance-payment) — `finance_payment`
- [finance.Receipt](#finance-receipt) — `finance_receipt`
- [finance.Supplier](#finance-supplier) — `finance_supplier`
- [finance.TafziliAccount](#finance-tafziliaccount) — `finance_tafziliaccount`
- [finance.TaxCategory](#finance-taxcategory) — `finance_taxcategory`
- [finance.TaxCode](#finance-taxcode) — `finance_taxcode`
- [finance.TaxRule](#finance-taxrule) — `finance_taxrule`
- [finance.TaxTransaction](#finance-taxtransaction) — `finance_taxtransaction`
- [hr.Attendance](#hr-attendance) — `hr_attendance`
- [hr.Candidate](#hr-candidate) — `hr_candidate`
- [hr.Department](#hr-department) — `hr_department`
- [hr.Employee](#hr-employee) — `hr_employee`
- [hr.LeaveRequest](#hr-leaverequest) — `hr_leaverequest`
- [hr.LeaveType](#hr-leavetype) — `hr_leavetype`
- [hr.PayrollPeriod](#hr-payrollperiod) — `hr_payrollperiod`
- [hr.PayrollRecord](#hr-payrollrecord) — `hr_payrollrecord`
- [hr.PerformanceEvaluation](#hr-performanceevaluation) — `hr_performanceevaluation`
- [hr.Recruitment](#hr-recruitment) — `hr_recruitment`
- [inventory.CycleCount](#inventory-cyclecount) — `inventory_cyclecount`
- [inventory.CycleCountLine](#inventory-cyclecountline) — `inventory_cyclecountline`
- [inventory.InventoryReservation](#inventory-inventoryreservation) — `inventory_inventoryreservation`
- [inventory.Location](#inventory-location) — `inventory_location`
- [inventory.StockAdjustment](#inventory-stockadjustment) — `inventory_stockadjustment`
- [inventory.StockLedger](#inventory-stockledger) — `inventory_stockledger`
- [inventory.StockMovement](#inventory-stockmovement) — `inventory_stockmovement`
- [inventory.Warehouse](#inventory-warehouse) — `inventory_warehouse`
- [llm.LLMChatMessage](#llm-llmchatmessage) — `llm_llmchatmessage`
- [llm.LLMChatSession](#llm-llmchatsession) — `llm_llmchatsession`
- [llm.LLMProvider](#llm-llmprovider) — `llm_llmprovider`
- [llm.LLMUsageLog](#llm-llmusagelog) — `llm_llmusagelog`
- [manufacturing.BOM](#manufacturing-bom) — `manufacturing_bom`
- [manufacturing.BOMLine](#manufacturing-bomline) — `manufacturing_bomline`
- [manufacturing.CorrectiveAction](#manufacturing-correctiveaction) — `manufacturing_correctiveaction`
- [manufacturing.FinishedGoodsReceipt](#manufacturing-finishedgoodsreceipt) — `manufacturing_finishedgoodsreceipt`
- [manufacturing.InspectionResult](#manufacturing-inspectionresult) — `manufacturing_inspectionresult`
- [manufacturing.MaterialConsumption](#manufacturing-materialconsumption) — `manufacturing_materialconsumption`
- [manufacturing.NonConformance](#manufacturing-nonconformance) — `manufacturing_nonconformance`
- [manufacturing.ProductionOrder](#manufacturing-productionorder) — `manufacturing_productionorder`
- [manufacturing.QualityPlan](#manufacturing-qualityplan) — `manufacturing_qualityplan`
- [manufacturing.Routing](#manufacturing-routing) — `manufacturing_routing`
- [manufacturing.RoutingOperation](#manufacturing-routingoperation) — `manufacturing_routingoperation`
- [manufacturing.WorkCenter](#manufacturing-workcenter) — `manufacturing_workcenter`
- [multi_tenant.Tenant](#multi_tenant-tenant) — `multi_tenant_tenant`
- [multi_tenant.TenantFeature](#multi_tenant-tenantfeature) — `multi_tenant_tenantfeature`
- [multi_tenant.TenantPlan](#multi_tenant-tenantplan) — `multi_tenant_tenantplan`
- [multi_tenant.TenantSubscription](#multi_tenant-tenantsubscription) — `multi_tenant_tenantsubscription`
- [office.BusinessRecordReference](#office-businessrecordreference) — `office_businessrecordreference`
- [office.Contract](#office-contract) — `office_contract`
- [office.Correspondence](#office-correspondence) — `office_correspondence`
- [office.CorrespondenceAction](#office-correspondenceaction) — `office_correspondenceaction`
- [office.CorrespondenceAttachment](#office-correspondenceattachment) — `office_correspondenceattachment`
- [office.CorrespondenceComment](#office-correspondencecomment) — `office_correspondencecomment`
- [office.CorrespondenceRecipient](#office-correspondencerecipient) — `office_correspondencerecipient`
- [office.CorrespondenceRoute](#office-correspondenceroute) — `office_correspondenceroute`
- [office.OfficeBusinessLink](#office-officebusinesslink) — `office_officebusinesslink`
- [office.Secretariat](#office-secretariat) — `office_secretariat`
- [office.SecretariatMember](#office-secretariatmember) — `office_secretariatmember`
- [office.SecretariatNumberSequence](#office-secretariatnumbersequence) — `office_secretariatnumbersequence`
- [purchasing.GoodsReceipt](#purchasing-goodsreceipt) — `purchasing_goodsreceipt`
- [purchasing.PurchaseOrder](#purchasing-purchaseorder) — `purchasing_purchaseorder`
- [purchasing.PurchaseRequest](#purchasing-purchaserequest) — `purchasing_purchaserequest`
- [purchasing.PurchaseReturn](#purchasing-purchasereturn) — `purchasing_purchasereturn`
- [rate_limiting.APIKey](#rate_limiting-apikey) — `rate_limiting_apikey`
- [rate_limiting.RateLimitLog](#rate_limiting-ratelimitlog) — `rate_limiting_ratelimitlog`
- [rate_limiting.RateLimitPolicy](#rate_limiting-ratelimitpolicy) — `rate_limiting_ratelimitpolicy`
- [reporting.Dashboard](#reporting-dashboard) — `reporting_dashboard`
- [reporting.DashboardWidget](#reporting-dashboardwidget) — `reporting_dashboardwidget`
- [reporting.KPI](#reporting-kpi) — `reporting_kpi`
- [reporting.ReportExecution](#reporting-reportexecution) — `reporting_reportexecution`
- [reporting.ReportSnapshot](#reporting-reportsnapshot) — `reporting_reportsnapshot`
- [reporting.ReportTemplate](#reporting-reporttemplate) — `reporting_reporttemplate`
- [reporting.ScheduledReport](#reporting-scheduledreport) — `reporting_scheduledreport`
- [sales.SalesInvoice](#sales-salesinvoice) — `sales_salesinvoice`
- [sales.SalesInvoiceLine](#sales-salesinvoiceline) — `sales_salesinvoiceline`
- [sales.SalesOrder](#sales-salesorder) — `sales_salesorder`
- [sales.SalesOrderLine](#sales-salesorderline) — `sales_salesorderline`
- [sales.SalesQuotation](#sales-salesquotation) — `sales_salesquotation`
- [sales.SalesQuotationLine](#sales-salesquotationline) — `sales_salesquotationline`
- [sales.SalesReturn](#sales-salesreturn) — `sales_salesreturn`
- [sales.SalesReturnLine](#sales-salesreturnline) — `sales_salesreturnline`
- [service_management.MaintenancePlan](#service_management-maintenanceplan) — `service_management_maintenanceplan`
- [service_management.MaintenanceSchedule](#service_management-maintenanceschedule) — `service_management_maintenanceschedule`
- [service_management.SLARule](#service_management-slarule) — `service_management_slarule`
- [service_management.ServiceContract](#service_management-servicecontract) — `service_management_servicecontract`
- [service_management.ServiceFeedback](#service_management-servicefeedback) — `service_management_servicefeedback`
- [service_management.ServicePart](#service_management-servicepart) — `service_management_servicepart`
- [service_management.ServiceRequest](#service_management-servicerequest) — `service_management_servicerequest`
- [service_management.Technician](#service_management-technician) — `service_management_technician`
- [service_management.Warranty](#service_management-warranty) — `service_management_warranty`
- [service_management.WorkOrder](#service_management-workorder) — `service_management_workorder`
- [service_management.WorkOrderOperation](#service_management-workorderoperation) — `service_management_workorderoperation`
- [service_sales.Booking](#service_sales-booking) — `service_sales_booking`
- [service_sales.BookingLine](#service_sales-bookingline) — `service_sales_bookingline`
- [service_sales.CommissionRule](#service_sales-commissionrule) — `service_sales_commissionrule`
- [service_sales.CommissionTransaction](#service_sales-commissiontransaction) — `service_sales_commissiontransaction`
- [service_sales.HotelReservation](#service_sales-hotelreservation) — `service_sales_hotelreservation`
- [service_sales.Passenger](#service_sales-passenger) — `service_sales_passenger`
- [service_sales.RefundTransaction](#service_sales-refundtransaction) — `service_sales_refundtransaction`
- [service_sales.Service](#service_sales-service) — `service_sales_service`
- [service_sales.ServiceCategory](#service_sales-servicecategory) — `service_sales_servicecategory`
- [service_sales.ServiceProvider](#service_sales-serviceprovider) — `service_sales_serviceprovider`
- [service_sales.Ticket](#service_sales-ticket) — `service_sales_ticket`
- [service_sales.TourPackage](#service_sales-tourpackage) — `service_sales_tourpackage`
- [sso.SSOLoginAttempt](#sso-ssologinattempt) — `sso_ssologinattempt`
- [sso.SSOProvider](#sso-ssoprovider) — `sso_ssoprovider`
- [sso.SSORefreshToken](#sso-ssorefreshtoken) — `sso_ssorefreshtoken`
- [sso.SSOUserMapping](#sso-ssousermapping) — `sso_ssousermapping`
- [trading.Container](#trading-container) — `trading_container`
- [trading.CustomsDocument](#trading-customsdocument) — `trading_customsdocument`
- [trading.ExportOrder](#trading-exportorder) — `trading_exportorder`
- [trading.ImportOrder](#trading-importorder) — `trading_importorder`
- [trading.InternationalCost](#trading-internationalcost) — `trading_internationalcost`
- [trading.Shipment](#trading-shipment) — `trading_shipment`
- [workflow.WorkflowComment](#workflow-workflowcomment) — `workflow_workflowcomment`
- [workflow.WorkflowDefinition](#workflow-workflowdefinition) — `workflow_workflowdefinition`
- [workflow.WorkflowDelegation](#workflow-workflowdelegation) — `workflow_workflowdelegation`
- [workflow.WorkflowEscalationLog](#workflow-workflowescalationlog) — `workflow_workflowescalationlog`
- [workflow.WorkflowEscalationRule](#workflow-workflowescalationrule) — `workflow_workflowescalationrule`
- [workflow.WorkflowHistory](#workflow-workflowhistory) — `workflow_workflowhistory`
- [workflow.WorkflowInstance](#workflow-workflowinstance) — `workflow_workflowinstance`
- [workflow.WorkflowNotification](#workflow-workflownotification) — `workflow_workflownotification`
- [workflow.WorkflowNotificationRule](#workflow-workflownotificationrule) — `workflow_workflownotificationrule`
- [workflow.WorkflowRule](#workflow-workflowrule) — `workflow_workflowrule`
- [workflow.WorkflowSLARule](#workflow-workflowslarule) — `workflow_workflowslarule`
- [workflow.WorkflowSLATracker](#workflow-workflowslatracker) — `workflow_workflowslatracker`
- [workflow.WorkflowState](#workflow-workflowstate) — `workflow_workflowstate`
- [workflow.WorkflowTransition](#workflow-workflowtransition) — `workflow_workflowtransition`

## accounts.Company

Table: `accounts_company`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| name | `name` | CharField(255) |  |  |
| description | `description` | TextField |  | default: '' |
| logo | `logo` | FileField(100) | yes |  |
| primary_color | `primary_color` | CharField(7) |  | default: '#3678F6' |
| accent_color | `accent_color` | CharField(7) |  | default: '#24C6B2' |
| enabled_modules | `enabled_modules` | JSONField |  | default: [] |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## accounts.CompanyFont

Table: `accounts_companyfont`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(120) |  |  |
| file | `file` | FileField(100) |  |  |
| uploaded_by | `uploaded_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |

## accounts.CustomRole

Table: `accounts_customrole`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| value | `value` | CharField(50) |  | unique |
| label | `label` | CharField(100) |  |  |
| color | `color` | CharField(50) |  | default: 'bg-gray-100 text-gray-700' |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## accounts.Division

Table: `accounts_division`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(255) |  |  |
| description | `description` | TextField |  | default: '' |
| manager | `manager_id` | ForeignKey | yes | FK -> accounts.User |
| parent | `parent_id` | ForeignKey | yes | FK -> accounts.Division |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## accounts.RoleFilter

Table: `accounts_rolefilter`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| role | `role` | CharField(20) |  |  |
| filter_name | `filter_name` | CharField(100) |  |  |
| filter_column | `filter_column` | CharField(200) |  |  |
| filter_values | `filter_values` | JSONField |  | default: [] |
| description | `description` | TextField |  | default: '' |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## accounts.Team

Table: `accounts_team`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| division | `division_id` | ForeignKey |  | FK -> accounts.Division |
| name | `name` | CharField(255) |  |  |
| description | `description` | TextField |  | default: '' |
| manager | `manager_id` | ForeignKey | yes | FK -> accounts.User |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## accounts.User

Table: `accounts_user`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| password | `password` | CharField(128) |  |  |
| last_login | `last_login` | DateTimeField | yes |  |
| is_superuser | `is_superuser` | BooleanField |  | default: False |
| username | `username` | CharField(150) |  | unique |
| first_name | `first_name` | CharField(150) |  |  |
| last_name | `last_name` | CharField(150) |  |  |
| email | `email` | CharField(254) |  |  |
| is_staff | `is_staff` | BooleanField |  | default: False |
| is_active | `is_active` | BooleanField |  | default: True |
| date_joined | `date_joined` | DateTimeField |  | default: 'datetime.datetime(2026, 11, 21, 8, 32, 5, 316554, tzinfo=datetime.timezone.utc)' |
| role | `role` | CharField(20) |  | choices: finance, sales, ceo, admin; default: 'sales' |
| department | `department` | CharField(100) |  | default: '' |
| avatar | `avatar` | FileField(100) | yes |  |
| company | `company_id` | ForeignKey | yes | FK -> accounts.Company |
| division | `division_id` | ForeignKey | yes | FK -> accounts.Division |
| team | `team_id` | ForeignKey | yes | FK -> accounts.Team |
| reports_to | `reports_to_id` | ForeignKey | yes | FK -> accounts.User |
| can_view | `can_view` | BooleanField |  | default: True |
| can_pay | `can_pay` | BooleanField |  | default: False |
| can_issue | `can_issue` | BooleanField |  | default: False |
| can_manage_users | `can_manage_users` | BooleanField |  | default: False |
| can_manage_settings | `can_manage_settings` | BooleanField |  | default: False |
| can_delete_history | `can_delete_history` | BooleanField |  | default: False |
| can_delete_payment | `can_delete_payment` | BooleanField |  | default: False |
| can_export | `can_export` | BooleanField |  | default: False |
| can_manage_companies | `can_manage_companies` | BooleanField |  | default: False |
| can_submit | `can_submit` | BooleanField |  | default: True |
| can_approve | `can_approve` | BooleanField |  | default: False |
| can_edit_template | `can_edit_template` | BooleanField |  | default: False |

## ai_insights.AIInsight

Table: `ai_insights_aiinsight`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| insight_type | `insight_type` | CharField(20) |  | choices: anomaly, forecast, recommendation, trend, summary |
| title | `title` | CharField(255) |  |  |
| description | `description` | TextField |  |  |
| severity | `severity` | CharField(20) |  | choices: info, warning, critical; default: 'info' |
| module | `module` | CharField(50) |  | default: '' |
| data_payload | `data_payload` | JSONField |  | default: {} |
| is_read | `is_read` | BooleanField |  | default: False |
| is_dismissed | `is_dismissed` | BooleanField |  | default: False |

## ai_insights.AnomalyAlert

Table: `ai_insights_anomalyalert`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| anomaly | `anomaly_id` | ForeignKey | yes | FK -> ai_insights.AnomalyDetection |
| module | `module` | CharField(50) |  |  |
| title | `title` | CharField(255) |  |  |
| message | `message` | TextField |  |  |
| severity | `severity` | CharField(20) |  | choices: low, medium, high, critical; default: 'medium' |
| is_read | `is_read` | BooleanField |  | default: False |
| is_notified | `is_notified` | BooleanField |  | default: False |

## ai_insights.AnomalyDetection

Table: `ai_insights_anomalydetection`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| module | `module` | CharField(50) |  | choices: finance, sales, inventory, hr, manufacturing, service_management |
| metric_name | `metric_name` | CharField(100) |  |  |
| expected_value | `expected_value` | DecimalField |  | default: 0 |
| actual_value | `actual_value` | DecimalField |  | default: 0 |
| deviation_pct | `deviation_pct` | DecimalField |  | default: 0 |
| severity | `severity` | CharField(20) |  | choices: low, medium, high, critical; default: 'medium' |
| description | `description` | TextField |  | default: '' |
| is_resolved | `is_resolved` | BooleanField |  | default: False |

## ai_insights.Forecast

Table: `ai_insights_forecast`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| module | `module` | CharField(50) |  |  |
| metric_name | `metric_name` | CharField(100) |  |  |
| forecast_period | `forecast_period` | CharField(50) |  |  |
| forecast_data | `forecast_data` | JSONField |  | default: [] |
| accuracy_score | `accuracy_score` | DecimalField | yes |  |
| model_used | `model_used` | CharField(100) |  | default: 'linear_regression' |

## ai_insights.NLQuery

Table: `ai_insights_nlquery`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| query_text | `query_text` | TextField |  |  |
| generated_sql | `generated_sql` | TextField |  | default: '' |
| result_data | `result_data` | JSONField |  | default: {} |
| execution_time_ms | `execution_time_ms` | IntegerField |  | default: 0 |
| status | `status` | CharField(20) |  | choices: pending, executing, completed, failed; default: 'pending' |
| error_message | `error_message` | TextField |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |

## audit_log.AuditLog

Table: `audit_log_auditlog`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| action | `action` | CharField(20) |  | choices: create, update, delete, view |
| timestamp | `timestamp` | DateTimeField |  |  |
| user | `user_id` | ForeignKey | yes | FK -> accounts.User |
| ip_address | `ip_address` | GenericIPAddressField(39) | yes |  |
| user_agent | `user_agent` | TextField |  | default: '' |
| content_type | `content_type_id` | ForeignKey | yes | FK -> contenttypes.ContentType |
| object_id | `object_id` | CharField(255) |  | default: '' |
| description | `description` | TextField |  | default: '' |
| old_values | `old_values` | JSONField |  | default: {} |
| new_values | `new_values` | JSONField |  | default: {} |
| changed_fields | `changed_fields` | JSONField |  | default: [] |
| module | `module` | CharField(50) |  | default: '' |
| company | `company_id` | ForeignKey | yes | FK -> accounts.Company |
| metadata | `metadata` | JSONField |  | default: {} |

## audit_log.AuditLogConfig

Table: `audit_log_auditlogconfig`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| content_type | `content_type_id` | OneToOneField |  | FK -> contenttypes.ContentType; unique |
| is_enabled | `is_enabled` | BooleanField |  | default: True |
| track_fields | `track_fields` | JSONField |  | default: [] |
| exclude_fields | `exclude_fields` | JSONField |  | default: [] |
| capture_snapshots | `capture_snapshots` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## billing.ApprovalRequest

Table: `billing_approvalrequest`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| requester | `requester_id` | ForeignKey |  | FK -> accounts.User |
| requester_name | `requester_name` | CharField(50) |  |  |
| payer_code | `payer_code` | CharField(5) |  |  |
| payer_name | `payer_name` | CharField(100) |  |  |
| service_type | `service_type` | CharField(50) |  |  |
| letter_number | `letter_number` | CharField(50) |  |  |
| letter_date | `letter_date` | CharField(20) |  |  |
| start_day | `start_day` | IntegerField |  |  |
| end_day | `end_day` | IntegerField |  |  |
| month | `month` | CharField(20) |  |  |
| year | `year` | IntegerField |  |  |
| period_range | `period_range` | CharField(100) |  |  |
| service_data | `service_data` | JSONField |  | default: [] |
| flight_data | `flight_data` | JSONField |  | default: [] |
| hotel_data | `hotel_data` | JSONField |  | default: [] |
| reserved_numbers | `reserved_numbers` | JSONField |  | default: [] |
| service_letters | `service_letters` | JSONField |  | default: {} |
| service_category | `service_category` | CharField(100) |  | default: '' |
| status | `status` | CharField(20) |  | choices: pending, approved, rejected; default: 'pending' |
| rejection_reason | `rejection_reason` | CharField(500) |  | default: '' |
| approved_by | `approved_by_id` | ForeignKey | yes | FK -> accounts.User |
| approved_at | `approved_at` | DateTimeField | yes |  |
| generation_completed_at | `generation_completed_at` | DateTimeField | yes |  |
| generation_error | `generation_error` | TextField |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |

## billing.AvailableLetterNumber

Table: `billing_availableletternumber`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| payer_code | `payer_code` | CharField(5) |  |  |
| year | `year` | CharField(2) |  |  |
| number | `number` | IntegerField |  |  |

## billing.BillingAuditEntry

Table: `billing_billingauditentry`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| entity | `entity` | CharField(20) |  |  |
| object_id | `object_id` | CharField(40) |  |  |
| object_label | `object_label` | CharField(200) |  | default: '' |
| action | `action` | CharField(20) |  | choices: reversed, deleted |
| reason | `reason` | CharField(500) |  | default: '' |
| snapshot | `snapshot` | JSONField |  | default: {} |
| actor | `actor_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |

## billing.CompanySettings

Table: `billing_companysettings`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | PositiveSmallIntegerField |  | unique; default: 1 |
| company_name | `company_name` | CharField(200) |  | default: '' |
| national_id | `national_id` | CharField(20) |  | default: '' |
| economic_code | `economic_code` | CharField(20) |  | default: '' |
| registration_number | `registration_number` | CharField(20) |  | default: '' |
| address | `address` | TextField |  | default: '' |
| postal_code | `postal_code` | CharField(20) |  | default: '' |
| phone | `phone` | CharField(20) |  | default: '' |
| bank_name1 | `bank_name1` | CharField(100) |  | default: '' |
| account_number1 | `account_number1` | CharField(50) |  | default: '' |
| shaba_number1 | `shaba_number1` | CharField(50) |  | default: '' |
| bank_name2 | `bank_name2` | CharField(100) |  | default: '' |
| account_number2 | `account_number2` | CharField(50) |  | default: '' |
| shaba_number2 | `shaba_number2` | CharField(50) |  | default: '' |
| word_template_path | `word_template_path` | CharField(500) |  | default: '' |
| word_template_subsidiary_path | `word_template_subsidiary_path` | CharField(500) |  | default: '' |
| word_template_credit_path | `word_template_credit_path` | CharField(500) |  | default: '' |
| legal_note | `legal_note` | TextField |  | default: '' |
| logo_path | `logo_path` | CharField(500) |  | default: '' |
| signature_path | `signature_path` | CharField(500) |  | default: '' |
| stamp_path | `stamp_path` | CharField(500) |  | default: '' |
| manager_name | `manager_name` | CharField(100) |  | default: '' |
| manager_position | `manager_position` | CharField(100) |  | default: '' |
| approved_output_path | `approved_output_path` | CharField(500) |  | default: '' |

## billing.Credit

Table: `billing_credit`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| payer_code | `payer_code` | CharField(5) |  |  |
| amount | `amount` | BigIntegerField |  |  |
| credit_date | `credit_date` | DateField |  |  |
| description | `description` | CharField(200) |  | default: '' |
| invoice_number | `invoice_number` | CharField(50) |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |

## billing.FinalFile

Table: `billing_finalfile`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| request | `request_id` | ForeignKey |  | FK -> billing.ApprovalRequest |
| letter_number | `letter_number` | CharField(50) |  |  |
| service_type | `service_type` | CharField(50) |  |  |
| file_name | `file_name` | CharField(200) |  |  |
| file_path | `file_path` | CharField(500) |  | default: '' |
| file_data | `file_data` | BinaryField | yes |  |
| created_at | `created_at` | DateTimeField |  |  |
| last_accessed | `last_accessed` | DateTimeField | yes |  |
| is_deleted_from_disk | `is_deleted_from_disk` | BooleanField |  | default: False |
| purged_at | `purged_at` | DateTimeField | yes |  |

## billing.Invoice

Table: `billing_invoice`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| letter_number | `letter_number` | CharField(50) |  |  |
| payer | `payer` | CharField(100) |  |  |
| payer_code | `payer_code` | CharField(5) |  |  |
| invoice_type | `invoice_type` | CharField(50) |  |  |
| amount | `amount` | BigIntegerField |  |  |
| issue_date | `issue_date` | DateField |  |  |
| file_path | `file_path` | CharField(500) |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |
| reversed_at | `reversed_at` | DateTimeField | yes |  |
| reversed_by | `reversed_by_id` | ForeignKey | yes | FK -> accounts.User |
| reversal_reason | `reversal_reason` | CharField(500) |  | default: '' |

## billing.InvoiceTemplate

Table: `billing_invoicetemplate`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| name | `name` | CharField(100) |  |  |
| description | `description` | CharField(500) |  | default: '' |
| html_content | `html_content` | TextField |  | default: '' |
| css_content | `css_content` | TextField |  | default: '' |
| settings_json | `settings_json` | JSONField |  | default: {} |
| is_active | `is_active` | BooleanField |  | default: True |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## billing.LetterSequence

Table: `billing_lettersequence`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| payer_code | `payer_code` | CharField(5) |  |  |
| year | `year` | CharField(2) |  |  |
| last_number | `last_number` | IntegerField |  | default: 0 |

## billing.ManualDebt

Table: `billing_manualdebt`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| payer_code | `payer_code` | CharField(5) |  |  |
| description | `description` | CharField(200) |  |  |
| amount | `amount` | BigIntegerField |  |  |
| date | `date` | DateField |  |  |
| notes | `notes` | CharField(500) |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |

## billing.Payer

Table: `billing_payer`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| code | `code` | CharField(5) |  | unique |
| name | `name` | CharField(100) |  |  |
| parent | `parent_id` | ForeignKey | yes | FK -> billing.Payer |
| national_id | `national_id` | CharField(20) |  | default: '' |
| economic_code | `economic_code` | CharField(20) |  | default: '' |
| registration_number | `registration_number` | CharField(20) |  | default: '' |
| address | `address` | TextField |  | default: '' |
| postal_code | `postal_code` | CharField(20) |  | default: '' |
| phone | `phone` | CharField(20) |  | default: '' |
| mobile | `mobile` | CharField(20) |  | default: '' |
| email | `email` | CharField(100) |  | default: '' |
| customer_type | `customer_type` | CharField(10) |  | choices: legal, person; default: 'legal' |

## billing.Payment

Table: `billing_payment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| payment_code | `payment_code` | CharField(20) |  | default: '' |
| payer_code | `payer_code` | CharField(5) |  |  |
| payer_name | `payer_name` | CharField(100) |  |  |
| payment_date | `payment_date` | DateField |  |  |
| amount | `amount` | BigIntegerField |  |  |
| tracking_number | `tracking_number` | CharField(50) |  | default: '' |
| description | `description` | CharField(500) |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| idempotency_key | `idempotency_key` | CharField(100) | yes |  |

## billing.ReportDesign

Table: `billing_reportdesign`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | PositiveSmallIntegerField |  | unique; default: 1 |
| name | `name` | CharField(100) |  | default: 'طراحی پیش\u200cفرض' |
| design_json | `design_json` | JSONField |  | default: {} |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_at | `updated_at` | DateTimeField |  |  |

## billing.ServiceCategory

Table: `billing_servicecategory`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| parent | `parent_id` | ForeignKey | yes | FK -> billing.ServiceCategory |
| name | `name` | CharField(100) |  |  |
| code | `code` | CharField(20) |  | unique |
| is_active | `is_active` | BooleanField |  | default: True |
| display_order | `display_order` | IntegerField |  | default: 0 |
| created_at | `created_at` | DateTimeField |  |  |

## crm.Activity

Table: `crm_activity`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| activity_type | `activity_type` | CharField(20) |  | choices: call, email, meeting, task, note, sms; default: 'call' |
| subject | `subject` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| status | `status` | CharField(20) |  | choices: planned, in_progress, completed, cancelled; default: 'planned' |
| priority | `priority` | CharField(10) |  | choices: low, medium, high; default: 'medium' |
| lead | `lead_id` | ForeignKey | yes | FK -> crm.Lead |
| opportunity | `opportunity_id` | ForeignKey | yes | FK -> crm.Opportunity |
| customer | `customer_id` | ForeignKey | yes | FK -> finance.Customer |
| due_date | `due_date` | DateTimeField | yes |  |
| completed_at | `completed_at` | DateTimeField | yes |  |
| duration_minutes | `duration_minutes` | IntegerField |  | default: 0 |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |
| outcome | `outcome` | TextField |  | default: '' |

## crm.CRMTask

Table: `crm_crmtask`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| title | `title` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| priority | `priority` | CharField(10) |  | choices: low, medium, high, urgent; default: 'medium' |
| status | `status` | CharField(20) |  | choices: todo, in_progress, completed, cancelled; default: 'todo' |
| lead | `lead_id` | ForeignKey | yes | FK -> crm.Lead |
| opportunity | `opportunity_id` | ForeignKey | yes | FK -> crm.Opportunity |
| customer | `customer_id` | ForeignKey | yes | FK -> finance.Customer |
| due_date | `due_date` | DateField | yes |  |
| completed_at | `completed_at` | DateTimeField | yes |  |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |

## crm.Campaign

Table: `crm_campaign`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| campaign_type | `campaign_type` | CharField(20) |  | choices: email, social_media, content, event, advertising, referral, other; default: 'email' |
| status | `status` | CharField(20) |  | choices: draft, planned, active, paused, completed, cancelled; default: 'draft' |
| description | `description` | TextField |  | default: '' |
| target_audience | `target_audience` | TextField |  | default: '' |
| budget | `budget` | DecimalField |  | default: "Decimal('0')" |
| actual_cost | `actual_cost` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| start_date | `start_date` | DateField | yes |  |
| end_date | `end_date` | DateField | yes |  |
| expected_leads | `expected_leads` | IntegerField |  | default: 0 |
| actual_leads | `actual_leads` | IntegerField |  | default: 0 |
| expected_opportunities | `expected_opportunities` | IntegerField |  | default: 0 |
| actual_opportunities | `actual_opportunities` | IntegerField |  | default: 0 |
| expected_revenue | `expected_revenue` | DecimalField |  | default: "Decimal('0')" |
| actual_revenue | `actual_revenue` | DecimalField |  | default: "Decimal('0')" |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |
| notes | `notes` | TextField |  | default: '' |

## crm.CustomerTimeline

Table: `crm_customertimeline`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| entity_type | `entity_type` | CharField(20) |  | choices: lead, opportunity, activity, campaign, task, sale, service |
| entity_id | `entity_id` | IntegerField |  |  |
| entity_label | `entity_label` | CharField(200) |  | default: '' |
| event_type | `event_type` | CharField(100) |  |  |
| description | `description` | TextField |  | default: '' |
| performed_by | `performed_by_id` | ForeignKey | yes | FK -> accounts.User |

## crm.Lead

Table: `crm_lead`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| company_name | `company_name` | CharField(200) |  | default: '' |
| email | `email` | CharField(254) |  | default: '' |
| phone | `phone` | CharField(20) |  | default: '' |
| mobile | `mobile` | CharField(20) |  | default: '' |
| website | `website` | CharField(200) |  | default: '' |
| address | `address` | TextField |  | default: '' |
| status | `status` | CharField(20) |  | choices: new, contacted, qualified, unqualified, converted, lost; default: 'new' |
| source | `source` | CharField(20) |  | choices: website, referral, campaign, social_media, phone, email, event, other; default: 'other' |
| priority | `priority` | CharField(10) |  | choices: low, medium, high; default: 'medium' |
| industry | `industry` | CharField(100) |  | default: '' |
| employees_count | `employees_count` | IntegerField | yes |  |
| annual_revenue | `annual_revenue` | DecimalField | yes |  |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |
| converted_customer | `converted_customer_id` | ForeignKey | yes | FK -> finance.Customer |
| converted_at | `converted_at` | DateTimeField | yes |  |
| campaign | `campaign_id` | ForeignKey | yes | FK -> crm.Campaign |
| score | `score` | IntegerField |  | default: 0 |
| notes | `notes` | TextField |  | default: '' |

## crm.Opportunity

Table: `crm_opportunity`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| customer | `customer_id` | ForeignKey | yes | FK -> finance.Customer |
| lead | `lead_id` | ForeignKey | yes | FK -> crm.Lead |
| status | `status` | CharField(20) |  | choices: prospecting, qualification, proposal, negotiation, closed_won, closed_lost; default: 'prospecting' |
| stage | `stage` | CharField(20) |  | choices: lead, qualified, proposal_sent, verbal_agreement, contract_sent, closed; default: 'lead' |
| priority | `priority` | CharField(10) |  | choices: low, medium, high; default: 'medium' |
| estimated_value | `estimated_value` | DecimalField |  | default: "Decimal('0')" |
| probability | `probability` | IntegerField |  | default: 0 |
| weighted_value | `weighted_value` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| expected_close_date | `expected_close_date` | DateField | yes |  |
| actual_close_date | `actual_close_date` | DateField | yes |  |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |
| source | `source` | CharField(20) |  | choices: website, referral, campaign, social_media, phone, email, event, other; default: 'other' |
| campaign | `campaign_id` | ForeignKey | yes | FK -> crm.Campaign |
| description | `description` | TextField |  | default: '' |
| loss_reason | `loss_reason` | CharField(500) |  | default: '' |

## crm.SmsMessage

Table: `crm_smsmessage`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| phone | `phone` | CharField(20) |  |  |
| body | `body` | TextField |  |  |
| provider | `provider` | CharField(20) |  | default: '' |
| status | `status` | CharField(10) |  | choices: sent, failed; default: 'sent' |
| provider_message_id | `provider_message_id` | CharField(120) |  | default: '' |
| error | `error` | TextField |  | default: '' |
| campaign | `campaign_id` | ForeignKey | yes | FK -> crm.Campaign |

## crm.SmsSettings

Table: `crm_smssettings`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| provider | `provider` | CharField(20) |  | choices: kavenegar, niksms, generic; default: 'kavenegar' |
| api_key | `api_key` | CharField(255) |  | default: '' |
| sender | `sender` | CharField(40) |  | default: '' |
| endpoint | `endpoint` | CharField(300) |  | default: '' |
| username | `username` | CharField(100) |  | default: '' |
| password | `password` | CharField(150) |  | default: '' |
| enabled | `enabled` | BooleanField |  | default: False |

## dashboards.Dashboard

Table: `dashboards_dashboard`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| name | `name` | CharField(255) |  |  |
| description | `description` | TextField |  | default: '' |
| owner | `owner_id` | ForeignKey |  | FK -> accounts.User |
| layout | `layout` | JSONField |  | default: [] |
| allowed_roles | `allowed_roles` | JSONField |  | default: [] |
| is_published | `is_published` | BooleanField |  | default: False |
| filter_controls | `filter_controls` | JSONField |  | default: [] |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## dashboards.DashboardAssignment

Table: `dashboards_dashboardassignment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| dashboard | `dashboard_id` | ForeignKey |  | FK -> dashboards.Dashboard |
| assigned_to | `assigned_to_id` | ForeignKey |  | FK -> accounts.User |
| assigned_by | `assigned_by_id` | ForeignKey | yes | FK -> accounts.User |
| data_filters | `data_filters` | JSONField |  | default: [] |
| visible_pages | `visible_pages` | JSONField |  | default: [] |
| visible_filter_controls | `visible_filter_controls` | JSONField |  | default: [] |
| notes | `notes` | TextField |  | default: '' |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## dashboards.DashboardPage

Table: `dashboards_dashboardpage`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| dashboard | `dashboard_id` | ForeignKey |  | FK -> dashboards.Dashboard |
| name | `name` | CharField(255) |  | default: 'صفحه ۱' |
| order | `order` | IntegerField |  | default: 0 |
| layout | `layout` | JSONField |  | default: [] |
| mobile_layout | `mobile_layout` | JSONField |  | default: [] |
| filter_controls | `filter_controls` | JSONField |  | default: [] |
| allowed_roles | `allowed_roles` | JSONField |  | default: [] |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## dashboards.Notification

Table: `dashboards_notification`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| recipient | `recipient_id` | ForeignKey |  | FK -> accounts.User |
| notification_type | `notification_type` | CharField(50) |  | choices: assignment_new, assignment_updated, assignment_removed, system |
| title | `title` | CharField(255) |  |  |
| message | `message` | TextField |  | default: '' |
| target_type | `target_type` | CharField(50) |  | default: '' |
| target_id | `target_id` | CharField(100) |  | default: '' |
| is_read | `is_read` | BooleanField |  | default: False |
| created_at | `created_at` | DateTimeField |  |  |

## dashboards.PermissionAuditLog

Table: `dashboards_permissionauditlog`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| action | `action` | CharField(50) |  | choices: dashboard_share, dashboard_create, dashboard_delete, page_access_update, filter_access_update, user_role_change |
| user | `user_id` | ForeignKey | yes | FK -> accounts.User |
| target_type | `target_type` | CharField(50) |  |  |
| target_id | `target_id` | CharField(100) |  |  |
| target_name | `target_name` | CharField(255) |  | default: '' |
| old_value | `old_value` | JSONField |  | default: {} |
| new_value | `new_value` | JSONField |  | default: {} |
| details | `details` | JSONField |  | default: {} |
| created_at | `created_at` | DateTimeField |  |  |

## dashboards.Widget

Table: `dashboards_widget`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| dashboard | `dashboard_id` | ForeignKey |  | FK -> dashboards.Dashboard |
| page | `page_id` | ForeignKey | yes | FK -> dashboards.DashboardPage |
| title | `title` | CharField(255) |  | default: 'Untitled Widget' |
| chart_type | `chart_type` | CharField(20) |  | choices: bar, bar_horizontal, stacked_bar, line, area, pie, donut, scatter, gauge, table, kpi, heatmap, treemap, sankey, funnel, radar, graph, map, leader_kpi; default: 'bar' |
| dataset | `dataset_id` | ForeignKey | yes | FK -> datasets.Dataset |
| chart_config | `chart_config` | JSONField |  | default: {} |
| query_config | `query_config` | JSONField |  | default: {} |
| grid_x | `grid_x` | IntegerField |  | default: 0 |
| grid_y | `grid_y` | IntegerField |  | default: 0 |
| grid_w | `grid_w` | IntegerField |  | default: 6 |
| grid_h | `grid_h` | IntegerField |  | default: 4 |
| order | `order` | IntegerField |  | default: 0 |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## datasets.DataFilter

Table: `datasets_datafilter`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| dataset | `dataset_id` | ForeignKey |  | FK -> datasets.Dataset |
| role | `role` | CharField(20) |  |  |
| column_name | `column_name` | CharField(200) |  |  |
| operator | `operator` | CharField(20) |  | choices: eq, in, contains, gt, lt; default: 'eq' |
| value | `value` | JSONField |  |  |
| is_active | `is_active` | BooleanField |  | default: True |

## datasets.Dataset

Table: `datasets_dataset`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| name | `name` | CharField(255) |  |  |
| description | `description` | TextField |  | default: '' |
| original_file | `original_file` | FileField(100) |  |  |
| table_name | `table_name` | CharField(100) |  | unique |
| status | `status` | CharField(20) |  | choices: uploading, processing, ready, error; default: 'uploading' |
| row_count | `row_count` | PositiveIntegerField |  | default: 0 |
| column_count | `column_count` | PositiveIntegerField |  | default: 0 |
| column_names | `column_names` | JSONField |  | default: [] |
| column_types | `column_types` | JSONField |  | default: {} |
| superset_dataset_id | `superset_dataset_id` | PositiveIntegerField | yes |  |
| allowed_roles | `allowed_roles` | JSONField |  | default: [] |
| owner | `owner_id` | ForeignKey |  | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## db_manager.DatabasePermission

Table: `db_manager_databasepermission`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| user | `user_id` | ForeignKey |  | FK -> accounts.User |
| database_source | `database_source` | CharField(100) |  |  |
| table_name | `table_name` | CharField(255) |  |  |
| can_edit | `can_edit` | BooleanField |  | default: True |
| can_schema | `can_schema` | BooleanField |  | default: False |
| can_import | `can_import` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## db_manager.ExternalDatabase

Table: `db_manager_externaldatabase`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| name | `name` | CharField(255) |  |  |
| host | `host` | CharField(255) |  |  |
| port | `port` | IntegerField |  | default: 5432 |
| database | `database` | CharField(255) |  |  |
| _username | `username` | CharField(512) |  |  |
| _password | `password` | CharField(512) |  |  |
| is_active | `is_active` | BooleanField |  | default: True |
| owner | `owner_id` | ForeignKey |  | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## db_manager.GoogleSheetsSync

Table: `db_manager_googlesheetssync`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| name | `name` | CharField(255) |  |  |
| spreadsheet_id | `spreadsheet_id` | CharField(100) |  |  |
| sheet_name | `sheet_name` | CharField(255) |  |  |
| database_source | `database_source` | CharField(100) |  |  |
| table_name | `table_name` | CharField(255) |  |  |
| sync_mode | `sync_mode` | CharField(20) |  | choices: replace, upsert; default: 'replace' |
| key_column | `key_column` | CharField(255) |  | default: '' |
| schedule | `schedule` | CharField(100) |  |  |
| is_active | `is_active` | BooleanField |  | default: True |
| last_sync_at | `last_sync_at` | DateTimeField | yes |  |
| last_sync_status | `last_sync_status` | CharField(20) |  | choices: pending, success, error; default: 'pending' |
| last_error | `last_error` | TextField |  | default: '' |
| owner | `owner_id` | ForeignKey |  | FK -> accounts.User |
| _credentials_json | `credentials_json` | JSONField |  | default: {} |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## finance.AccountGroup

Table: `finance_accountgroup`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| code | `code` | CharField(1) |  |  |
| name | `name` | CharField(100) |  |  |
| name_en | `name_en` | CharField(100) |  | default: '' |

## finance.BankAccount

Table: `finance_bankaccount`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| account_type | `account_type` | CharField(20) |  | choices: bank, cash, petty_cash |
| bank_name | `bank_name` | CharField(200) |  | default: '' |
| branch_name | `branch_name` | CharField(200) |  | default: '' |
| account_number | `account_number` | CharField(50) |  | default: '' |
| card_number | `card_number` | CharField(20) |  | default: '' |
| sheba_number | `sheba_number` | CharField(24) |  | default: '' |
| tafzili | `tafzili_id` | ForeignKey | yes | FK -> finance.TafziliAccount |
| opening_balance | `opening_balance` | BigIntegerField |  | default: 0 |
| current_balance | `current_balance` | BigIntegerField |  | default: 0 |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## finance.Cheque

Table: `finance_cheque`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| cheque_type | `cheque_type` | CharField(10) |  | choices: received, issued |
| number | `number` | CharField(20) |  |  |
| bank_name | `bank_name` | CharField(200) |  |  |
| branch_name | `branch_name` | CharField(200) |  | default: '' |
| amount | `amount` | BigIntegerField |  |  |
| issue_date_jalali | `issue_date_jalali` | CharField(10) |  |  |
| issue_date | `issue_date` | DateField |  |  |
| due_date_jalali | `due_date_jalali` | CharField(10) |  |  |
| due_date | `due_date` | DateField |  |  |
| customer | `customer_id` | ForeignKey | yes | FK -> finance.Customer |
| supplier | `supplier_id` | ForeignKey | yes | FK -> finance.Supplier |
| status | `status` | CharField(20) |  | choices: pending, passed, bounced, cancelled; default: 'pending' |
| description | `description` | CharField(500) |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## finance.Customer

Table: `finance_customer`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| tafzili | `tafzili_id` | OneToOneField | yes | FK -> finance.TafziliAccount; unique |
| name | `name` | CharField(200) |  |  |
| name_en | `name_en` | CharField(200) |  | default: '' |
| national_id | `national_id` | CharField(11) |  | default: '' |
| economic_code | `economic_code` | CharField(12) |  | default: '' |
| registration_number | `registration_number` | CharField(20) |  | default: '' |
| phone | `phone` | CharField(20) |  | default: '' |
| mobile | `mobile` | CharField(11) |  | default: '' |
| email | `email` | CharField(254) |  | default: '' |
| address | `address` | TextField |  | default: '' |
| postal_code | `postal_code` | CharField(10) |  | default: '' |
| credit_limit | `credit_limit` | BigIntegerField |  | default: 0 |
| balance | `balance` | BigIntegerField |  | default: 0 |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## finance.FiscalYear

Table: `finance_fiscalyear`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(50) |  |  |
| start_date_jalali | `start_date_jalali` | CharField(10) |  |  |
| end_date_jalali | `end_date_jalali` | CharField(10) |  |  |
| start_date | `start_date` | DateField |  |  |
| end_date | `end_date` | DateField |  |  |
| is_closed | `is_closed` | BooleanField |  | default: False |
| created_at | `created_at` | DateTimeField |  |  |

## finance.Invoice

Table: `finance_invoice`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| fiscal_year | `fiscal_year_id` | ForeignKey |  | FK -> finance.FiscalYear |
| number | `number` | IntegerField |  |  |
| type | `type` | CharField(20) |  | choices: sales, purchase, sales_return, purchase_return |
| date_jalali | `date_jalali` | CharField(10) |  |  |
| date | `date` | DateField |  |  |
| due_date_jalali | `due_date_jalali` | CharField(10) |  | default: '' |
| due_date | `due_date` | DateField | yes |  |
| customer | `customer_id` | ForeignKey | yes | FK -> finance.Customer |
| supplier | `supplier_id` | ForeignKey | yes | FK -> finance.Supplier |
| subtotal | `subtotal` | BigIntegerField |  | default: 0 |
| discount | `discount` | BigIntegerField |  | default: 0 |
| tax_rate | `tax_rate` | DecimalField |  | default: 10.0 |
| tax_amount | `tax_amount` | BigIntegerField |  | default: 0 |
| total | `total` | BigIntegerField |  | default: 0 |
| description | `description` | CharField(500) |  | default: '' |
| reference | `reference` | CharField(100) |  | default: '' |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| status | `status` | CharField(20) |  | choices: draft, confirmed, cancelled; default: 'draft' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## finance.InvoiceItem

Table: `finance_invoiceitem`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| invoice | `invoice_id` | ForeignKey |  | FK -> finance.Invoice |
| description | `description` | CharField(500) |  |  |
| quantity | `quantity` | DecimalField |  | default: 1 |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_price | `unit_price` | BigIntegerField |  | default: 0 |
| discount | `discount` | BigIntegerField |  | default: 0 |
| tax_rate | `tax_rate` | DecimalField |  | default: 10.0 |
| tax_amount | `tax_amount` | BigIntegerField |  | default: 0 |
| total | `total` | BigIntegerField |  | default: 0 |
| kol | `kol_id` | ForeignKey | yes | FK -> finance.KolAccount |
| moin | `moin_id` | ForeignKey | yes | FK -> finance.MoinAccount |

## finance.JournalEntry

Table: `finance_journalentry`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| voucher | `voucher_id` | ForeignKey |  | FK -> finance.JournalVoucher |
| kol | `kol_id` | ForeignKey |  | FK -> finance.KolAccount |
| moin | `moin_id` | ForeignKey | yes | FK -> finance.MoinAccount |
| tafzili | `tafzili_id` | ForeignKey | yes | FK -> finance.TafziliAccount |
| description | `description` | CharField(500) |  | default: '' |
| debit | `debit` | BigIntegerField |  | default: 0 |
| credit | `credit` | BigIntegerField |  | default: 0 |

## finance.JournalVoucher

Table: `finance_journalvoucher`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| fiscal_year | `fiscal_year_id` | ForeignKey |  | FK -> finance.FiscalYear |
| number | `number` | IntegerField |  |  |
| date_jalali | `date_jalali` | CharField(10) |  |  |
| date | `date` | DateField |  |  |
| description | `description` | CharField(500) |  |  |
| source_type | `source_type` | CharField(30) |  | choices: manual, invoice, receipt, payment, opening; default: 'manual' |
| source_id | `source_id` | IntegerField | yes |  |
| status | `status` | CharField(20) |  | choices: draft, confirmed, cancelled; default: 'draft' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| confirmed_by | `confirmed_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## finance.KolAccount

Table: `finance_kolaccount`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| group | `group_id` | ForeignKey |  | FK -> finance.AccountGroup |
| code | `code` | CharField(3) |  |  |
| name | `name` | CharField(200) |  |  |
| name_en | `name_en` | CharField(200) |  | default: '' |
| account_type | `account_type` | CharField(20) |  | choices: asset, liability, equity, revenue, expense |
| is_balance_sheet | `is_balance_sheet` | BooleanField |  | default: True |
| normal_balance | `normal_balance` | CharField(10) |  | choices: debit, credit |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## finance.MoinAccount

Table: `finance_moinaccount`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| kol | `kol_id` | ForeignKey |  | FK -> finance.KolAccount |
| code | `code` | CharField(4) |  |  |
| name | `name` | CharField(200) |  |  |
| name_en | `name_en` | CharField(200) |  | default: '' |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## finance.Payment

Table: `finance_payment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| fiscal_year | `fiscal_year_id` | ForeignKey |  | FK -> finance.FiscalYear |
| number | `number` | IntegerField |  |  |
| date_jalali | `date_jalali` | CharField(10) |  |  |
| date | `date` | DateField |  |  |
| supplier | `supplier_id` | ForeignKey |  | FK -> finance.Supplier |
| bank_account | `bank_account_id` | ForeignKey |  | FK -> finance.BankAccount |
| amount | `amount` | BigIntegerField |  |  |
| payment_method | `payment_method` | CharField(20) |  | choices: cash, bank_transfer, cheque, pos |
| reference | `reference` | CharField(100) |  | default: '' |
| description | `description` | CharField(500) |  | default: '' |
| invoice | `invoice_id` | ForeignKey | yes | FK -> finance.Invoice |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| status | `status` | CharField(20) |  | choices: draft, confirmed, cancelled; default: 'draft' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |

## finance.Receipt

Table: `finance_receipt`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| fiscal_year | `fiscal_year_id` | ForeignKey |  | FK -> finance.FiscalYear |
| number | `number` | IntegerField |  |  |
| date_jalali | `date_jalali` | CharField(10) |  |  |
| date | `date` | DateField |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| bank_account | `bank_account_id` | ForeignKey |  | FK -> finance.BankAccount |
| amount | `amount` | BigIntegerField |  |  |
| payment_method | `payment_method` | CharField(20) |  | choices: cash, bank_transfer, cheque, pos, online |
| reference | `reference` | CharField(100) |  | default: '' |
| description | `description` | CharField(500) |  | default: '' |
| invoice | `invoice_id` | ForeignKey | yes | FK -> finance.Invoice |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| status | `status` | CharField(20) |  | choices: draft, confirmed, cancelled; default: 'draft' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |

## finance.Supplier

Table: `finance_supplier`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| tafzili | `tafzili_id` | OneToOneField | yes | FK -> finance.TafziliAccount; unique |
| name | `name` | CharField(200) |  |  |
| name_en | `name_en` | CharField(200) |  | default: '' |
| national_id | `national_id` | CharField(11) |  | default: '' |
| economic_code | `economic_code` | CharField(12) |  | default: '' |
| phone | `phone` | CharField(20) |  | default: '' |
| mobile | `mobile` | CharField(11) |  | default: '' |
| email | `email` | CharField(254) |  | default: '' |
| address | `address` | TextField |  | default: '' |
| postal_code | `postal_code` | CharField(10) |  | default: '' |
| balance | `balance` | BigIntegerField |  | default: 0 |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## finance.TafziliAccount

Table: `finance_tafziliaccount`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| code | `code` | CharField(10) |  |  |
| name | `name` | CharField(200) |  |  |
| name_en | `name_en` | CharField(200) |  | default: '' |
| entity_type | `entity_type` | CharField(20) |  | choices: customer, supplier, employee, bank, other; default: 'other' |
| parent | `parent_id` | ForeignKey | yes | FK -> finance.TafziliAccount |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## finance.TaxCategory

Table: `finance_taxcategory`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| code | `code` | CharField(20) |  |  |
| name | `name` | CharField(100) |  |  |
| description | `description` | TextField |  | default: '' |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## finance.TaxCode

Table: `finance_taxcode`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| category | `category_id` | ForeignKey |  | FK -> finance.TaxCategory |
| code | `code` | CharField(30) |  |  |
| name | `name` | CharField(100) |  |  |
| rate | `rate` | DecimalField |  | default: "Decimal('10.00')" |
| effective_date | `effective_date` | DateField |  |  |
| expiry_date | `expiry_date` | DateField | yes |  |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## finance.TaxRule

Table: `finance_taxrule`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| tax_code | `tax_code_id` | ForeignKey |  | FK -> finance.TaxCode |
| conditions | `conditions` | JSONField |  | default: {} |
| priority | `priority` | IntegerField |  | default: 0 |
| version | `version` | IntegerField |  | default: 1 |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## finance.TaxTransaction

Table: `finance_taxtransaction`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| fiscal_year | `fiscal_year_id` | ForeignKey |  | FK -> finance.FiscalYear |
| tax_code | `tax_code_id` | ForeignKey |  | FK -> finance.TaxCode |
| tax_rule | `tax_rule_id` | ForeignKey | yes | FK -> finance.TaxRule |
| source_type | `source_type` | CharField(30) |  |  |
| source_id | `source_id` | IntegerField | yes |  |
| base_amount | `base_amount` | BigIntegerField |  |  |
| tax_amount | `tax_amount` | BigIntegerField |  |  |
| tax_rate | `tax_rate` | DecimalField |  |  |
| vat_type | `vat_type` | CharField(20) |  | choices: output, input, adjustment; default: 'output' |
| status | `status` | CharField(20) |  | choices: calculated, posted, reversed; default: 'calculated' |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| description | `description` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |

## hr.Attendance

Table: `hr_attendance`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| employee | `employee_id` | ForeignKey |  | FK -> hr.Employee |
| date | `date` | DateField |  |  |
| check_in | `check_in` | DateTimeField | yes |  |
| check_out | `check_out` | DateTimeField | yes |  |
| status | `status` | CharField(20) |  | choices: present, absent, late, half_day, holiday, weekend; default: 'present' |
| overtime_hours | `overtime_hours` | DecimalField |  | default: "Decimal('0')" |
| notes | `notes` | CharField(500) |  | default: '' |

## hr.Candidate

Table: `hr_candidate`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| recruitment | `recruitment_id` | ForeignKey |  | FK -> hr.Recruitment |
| first_name | `first_name` | CharField(100) |  |  |
| last_name | `last_name` | CharField(100) |  |  |
| email | `email` | CharField(254) |  | default: '' |
| phone | `phone` | CharField(20) |  | default: '' |
| resume | `resume` | FileField(100) | yes |  |
| cover_letter | `cover_letter` | TextField |  | default: '' |
| status | `status` | CharField(20) |  | choices: new, screening, interview, offer, hired, rejected; default: 'new' |
| notes | `notes` | TextField |  | default: '' |

## hr.Department

Table: `hr_department`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| code | `code` | CharField(20) |  | default: '' |
| description | `description` | TextField |  | default: '' |
| parent | `parent_id` | ForeignKey | yes | FK -> hr.Department |
| manager | `manager_id` | ForeignKey | yes | FK -> accounts.User |
| is_active | `is_active` | BooleanField |  | default: True |

## hr.Employee

Table: `hr_employee`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| user | `user_id` | OneToOneField | yes | FK -> accounts.User; unique |
| employee_id | `employee_id` | CharField(50) |  |  |
| first_name | `first_name` | CharField(100) |  |  |
| last_name | `last_name` | CharField(100) |  |  |
| national_id | `national_id` | CharField(20) |  | default: '' |
| birth_date | `birth_date` | DateField | yes |  |
| gender | `gender` | CharField(10) |  | choices: male, female, other; default: '' |
| email | `email` | CharField(254) |  | default: '' |
| phone | `phone` | CharField(20) |  | default: '' |
| mobile | `mobile` | CharField(20) |  | default: '' |
| address | `address` | TextField |  | default: '' |
| department | `department_id` | ForeignKey | yes | FK -> hr.Department |
| position | `position` | CharField(200) |  | default: '' |
| hire_date | `hire_date` | DateField |  |  |
| termination_date | `termination_date` | DateField | yes |  |
| status | `status` | CharField(20) |  | choices: active, on_leave, terminated, retired; default: 'active' |
| employment_type | `employment_type` | CharField(20) |  | choices: full_time, part_time, contract, intern; default: 'full_time' |
| base_salary | `base_salary` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| reports_to | `reports_to_id` | ForeignKey | yes | FK -> hr.Employee |
| skills | `skills` | CharField(500) |  | default: '' |

## hr.LeaveRequest

Table: `hr_leaverequest`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| employee | `employee_id` | ForeignKey |  | FK -> hr.Employee |
| leave_type | `leave_type_id` | ForeignKey |  | FK -> hr.LeaveType |
| start_date | `start_date` | DateField |  |  |
| end_date | `end_date` | DateField |  |  |
| days | `days` | IntegerField |  | default: 1 |
| reason | `reason` | TextField |  | default: '' |
| status | `status` | CharField(20) |  | choices: pending, approved, rejected, cancelled; default: 'pending' |
| approved_by | `approved_by_id` | ForeignKey | yes | FK -> accounts.User |
| approved_at | `approved_at` | DateTimeField | yes |  |
| rejection_reason | `rejection_reason` | CharField(500) |  | default: '' |

## hr.LeaveType

Table: `hr_leavetype`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(100) |  |  |
| code | `code` | CharField(20) |  | default: '' |
| default_days | `default_days` | IntegerField |  | default: 0 |
| is_paid | `is_paid` | BooleanField |  | default: True |
| is_active | `is_active` | BooleanField |  | default: True |

## hr.PayrollPeriod

Table: `hr_payrollperiod`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(100) |  |  |
| start_date | `start_date` | DateField |  |  |
| end_date | `end_date` | DateField |  |  |
| status | `status` | CharField(20) |  | choices: open, processing, closed; default: 'open' |

## hr.PayrollRecord

Table: `hr_payrollrecord`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| period | `period_id` | ForeignKey |  | FK -> hr.PayrollPeriod |
| employee | `employee_id` | ForeignKey |  | FK -> hr.Employee |
| base_salary | `base_salary` | DecimalField |  | default: "Decimal('0')" |
| overtime_pay | `overtime_pay` | DecimalField |  | default: "Decimal('0')" |
| bonuses | `bonuses` | DecimalField |  | default: "Decimal('0')" |
| allowances | `allowances` | DecimalField |  | default: "Decimal('0')" |
| total_earnings | `total_earnings` | DecimalField |  | default: "Decimal('0')" |
| tax | `tax` | DecimalField |  | default: "Decimal('0')" |
| insurance | `insurance` | DecimalField |  | default: "Decimal('0')" |
| other_deductions | `other_deductions` | DecimalField |  | default: "Decimal('0')" |
| total_deductions | `total_deductions` | DecimalField |  | default: "Decimal('0')" |
| net_pay | `net_pay` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| status | `status` | CharField(20) |  | choices: draft, approved, paid; default: 'draft' |
| notes | `notes` | TextField |  | default: '' |

## hr.PerformanceEvaluation

Table: `hr_performanceevaluation`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| employee | `employee_id` | ForeignKey |  | FK -> hr.Employee |
| evaluation_date | `evaluation_date` | DateField |  |  |
| period_label | `period_label` | CharField(50) |  |  |
| productivity_score | `productivity_score` | IntegerField |  | default: 3 |
| quality_score | `quality_score` | IntegerField |  | default: 3 |
| teamwork_score | `teamwork_score` | IntegerField |  | default: 3 |
| initiative_score | `initiative_score` | IntegerField |  | default: 3 |
| communication_score | `communication_score` | IntegerField |  | default: 3 |
| overall_score | `overall_score` | DecimalField |  | default: "Decimal('3.0')" |
| comments | `comments` | TextField |  | default: '' |
| goals | `goals` | TextField |  | default: '' |
| evaluator | `evaluator_id` | ForeignKey | yes | FK -> accounts.User |

## hr.Recruitment

Table: `hr_recruitment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| title | `title` | CharField(200) |  |  |
| department | `department_id` | ForeignKey | yes | FK -> hr.Department |
| description | `description` | TextField |  | default: '' |
| requirements | `requirements` | TextField |  | default: '' |
| salary_range_min | `salary_range_min` | DecimalField | yes |  |
| salary_range_max | `salary_range_max` | DecimalField | yes |  |
| positions_count | `positions_count` | IntegerField |  | default: 1 |
| status | `status` | CharField(20) |  | choices: open, on_hold, closed, cancelled; default: 'open' |
| posted_date | `posted_date` | DateField | yes |  |
| deadline_date | `deadline_date` | DateField | yes |  |

## inventory.CycleCount

Table: `inventory_cyclecount`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| warehouse | `warehouse_id` | ForeignKey |  | FK -> inventory.Warehouse |
| count_number | `count_number` | CharField(50) |  |  |
| count_date | `count_date` | DateField |  |  |
| status | `status` | CharField(20) |  | choices: draft, in_progress, completed, cancelled; default: 'draft' |
| counted_by | `counted_by_id` | ForeignKey | yes | FK -> accounts.User |
| notes | `notes` | CharField(500) |  | default: '' |

## inventory.CycleCountLine

Table: `inventory_cyclecountline`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| cycle_count | `cycle_count_id` | ForeignKey |  | FK -> inventory.CycleCount |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| location | `location_id` | ForeignKey | yes | FK -> inventory.Location |
| system_quantity | `system_quantity` | DecimalField |  |  |
| counted_quantity | `counted_quantity` | DecimalField | yes |  |
| variance | `variance` | DecimalField |  | default: "Decimal('0')" |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0')" |
| variance_value | `variance_value` | DecimalField |  | default: "Decimal('0')" |
| notes | `notes` | CharField(500) |  | default: '' |

## inventory.InventoryReservation

Table: `inventory_inventoryreservation`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| warehouse | `warehouse_id` | ForeignKey |  | FK -> inventory.Warehouse |
| quantity | `quantity` | DecimalField |  |  |
| quantity_fulfilled | `quantity_fulfilled` | DecimalField |  | default: "Decimal('0')" |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| reference_type | `reference_type` | CharField(30) |  |  |
| reference_id | `reference_id` | IntegerField |  |  |
| status | `status` | CharField(20) |  | choices: active, fulfilled, cancelled, expired; default: 'active' |
| expires_at | `expires_at` | DateTimeField | yes |  |
| reserved_by | `reserved_by_id` | ForeignKey | yes | FK -> accounts.User |
| notes | `notes` | CharField(500) |  | default: '' |

## inventory.Location

Table: `inventory_location`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| warehouse | `warehouse_id` | ForeignKey |  | FK -> inventory.Warehouse |
| code | `code` | CharField(30) |  |  |
| name | `name` | CharField(200) |  |  |
| parent | `parent_id` | ForeignKey | yes | FK -> inventory.Location |
| capacity | `capacity` | DecimalField |  | default: "Decimal('0')" |
| is_active | `is_active` | BooleanField |  | default: True |

## inventory.StockAdjustment

Table: `inventory_stockadjustment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| warehouse | `warehouse_id` | ForeignKey |  | FK -> inventory.Warehouse |
| adjustment_number | `adjustment_number` | CharField(50) |  |  |
| adjustment_date | `adjustment_date` | DateField |  |  |
| reason | `reason` | CharField(20) |  | choices: cycle_count, damage, found, correction, other |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| quantity_before | `quantity_before` | DecimalField |  |  |
| quantity_adjustment | `quantity_adjustment` | DecimalField |  |  |
| quantity_after | `quantity_after` | DecimalField |  |  |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0')" |
| adjustment_value | `adjustment_value` | DecimalField |  | default: "Decimal('0')" |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| cycle_count | `cycle_count_id` | ForeignKey | yes | FK -> inventory.CycleCount |
| description | `description` | CharField(500) |  | default: '' |
| approved_by | `approved_by_id` | ForeignKey | yes | FK -> accounts.User |

## inventory.StockLedger

Table: `inventory_stockledger`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| warehouse | `warehouse_id` | ForeignKey |  | FK -> inventory.Warehouse |
| location | `location_id` | ForeignKey | yes | FK -> inventory.Location |
| quantity_on_hand | `quantity_on_hand` | DecimalField |  | default: "Decimal('0')" |
| quantity_reserved | `quantity_reserved` | DecimalField |  | default: "Decimal('0')" |
| quantity_available | `quantity_available` | DecimalField |  | default: "Decimal('0')" |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0')" |
| total_value | `total_value` | DecimalField |  | default: "Decimal('0')" |
| reorder_level | `reorder_level` | DecimalField |  | default: "Decimal('0')" |
| reorder_quantity | `reorder_quantity` | DecimalField |  | default: "Decimal('0')" |
| last_receipt_date | `last_receipt_date` | DateTimeField | yes |  |
| last_issue_date | `last_issue_date` | DateTimeField | yes |  |
| last_count_date | `last_count_date` | DateTimeField | yes |  |

## inventory.StockMovement

Table: `inventory_stockmovement`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| warehouse | `warehouse_id` | ForeignKey |  | FK -> inventory.Warehouse |
| to_warehouse | `to_warehouse_id` | ForeignKey | yes | FK -> inventory.Warehouse |
| location | `location_id` | ForeignKey | yes | FK -> inventory.Location |
| movement_type | `movement_type` | CharField(20) |  | choices: receipt, issue, transfer, adjustment, reservation, release |
| reference_type | `reference_type` | CharField(30) |  | default: '' |
| reference_id | `reference_id` | IntegerField | yes |  |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| quantity | `quantity` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0')" |
| total_cost | `total_cost` | DecimalField |  | default: "Decimal('0')" |
| batch_number | `batch_number` | CharField(50) |  | default: '' |
| serial_number | `serial_number` | CharField(50) |  | default: '' |
| description | `description` | CharField(500) |  | default: '' |
| performed_by | `performed_by_id` | ForeignKey | yes | FK -> accounts.User |
| movement_date | `movement_date` | DateTimeField |  |  |

## inventory.Warehouse

Table: `inventory_warehouse`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| branch_name | `branch_name` | CharField(200) |  | default: '' |
| code | `code` | CharField(20) |  |  |
| name | `name` | CharField(200) |  |  |
| warehouse_type | `warehouse_type` | CharField(20) |  | choices: main, branch, production, returned, damaged; default: 'main' |
| address | `address` | TextField |  | default: '' |
| manager | `manager_id` | ForeignKey | yes | FK -> accounts.User |
| is_active | `is_active` | BooleanField |  | default: True |

## llm.LLMChatMessage

Table: `llm_llmchatmessage`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| session | `session_id` | ForeignKey |  | FK -> llm.LLMChatSession |
| role | `role` | CharField(10) |  | choices: system, user, assistant |
| content | `content` | TextField |  |  |
| metadata | `metadata` | JSONField |  | default: {} |
| created_at | `created_at` | DateTimeField |  |  |

## llm.LLMChatSession

Table: `llm_llmchatsession`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| user | `user_id` | ForeignKey |  | FK -> accounts.User |
| title | `title` | CharField(200) |  | default: '' |
| feature | `feature` | CharField(50) |  | default: 'chat' |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## llm.LLMProvider

Table: `llm_llmprovider`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| provider_type | `provider_type` | CharField(20) |  | choices: ollama, openai, gemini, anthropic, deepseek |
| name | `name` | CharField(100) |  |  |
| model_name | `model_name` | CharField(100) |  |  |
| api_base_url | `api_base_url` | CharField(200) |  | default: '' |
| api_key_encrypted | `api_key_encrypted` | TextField |  | default: '' |
| temperature | `temperature` | DecimalField |  | default: 0.7 |
| max_tokens | `max_tokens` | IntegerField |  | default: 4096 |
| is_active | `is_active` | BooleanField |  | default: False |
| is_default | `is_default` | BooleanField |  | default: False |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## llm.LLMUsageLog

Table: `llm_llmusagelog`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| provider | `provider_id` | ForeignKey | yes | FK -> llm.LLMProvider |
| user | `user_id` | ForeignKey | yes | FK -> accounts.User |
| feature | `feature` | CharField(50) |  | choices: text_to_sql, ocr, insights, chat, summarize; default: 'chat' |
| prompt_tokens | `prompt_tokens` | IntegerField |  | default: 0 |
| completion_tokens | `completion_tokens` | IntegerField |  | default: 0 |
| total_tokens | `total_tokens` | IntegerField |  | default: 0 |
| duration_ms | `duration_ms` | IntegerField |  | default: 0 |
| created_at | `created_at` | DateTimeField |  |  |

## manufacturing.BOM

Table: `manufacturing_bom`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| number | `number` | CharField(50) |  |  |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| version | `version` | IntegerField |  | default: 1 |
| revision | `revision` | CharField(20) |  | default: '' |
| effective_date | `effective_date` | DateField |  |  |
| expiry_date | `expiry_date` | DateField | yes |  |
| status | `status` | CharField(20) |  | choices: draft, active, obsolete; default: 'draft' |
| description | `description` | TextField |  | default: '' |
| base_quantity | `base_quantity` | DecimalField |  | default: "Decimal('1.00')" |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| approved_by | `approved_by_id` | ForeignKey | yes | FK -> accounts.User |
| approved_at | `approved_at` | DateTimeField | yes |  |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## manufacturing.BOMLine

Table: `manufacturing_bomline`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| bom | `bom_id` | ForeignKey |  | FK -> manufacturing.BOM |
| line_number | `line_number` | IntegerField |  |  |
| component_name | `component_name` | CharField(200) |  |  |
| component_code | `component_code` | CharField(50) |  | default: '' |
| quantity | `quantity` | DecimalField |  | default: "Decimal('1.0000')" |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0.00')" |
| scrap_percentage | `scrap_percentage` | DecimalField |  | default: "Decimal('0.00')" |
| consumption_type | `consumption_type` | CharField(20) |  | choices: manual, backflush, automatic; default: 'manual' |
| substitute_component | `substitute_component` | CharField(200) |  | default: '' |
| notes | `notes` | CharField(500) |  | default: '' |
| kol | `kol_id` | ForeignKey | yes | FK -> finance.KolAccount |

## manufacturing.CorrectiveAction

Table: `manufacturing_correctiveaction`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| non_conformance | `non_conformance_id` | ForeignKey |  | FK -> manufacturing.NonConformance |
| action_number | `action_number` | CharField(50) |  |  |
| description | `description` | TextField |  |  |
| status | `status` | CharField(20) |  | choices: planned, in_progress, completed, verified; default: 'planned' |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |
| due_date | `due_date` | DateField | yes |  |
| completed_at | `completed_at` | DateTimeField | yes |  |

## manufacturing.FinishedGoodsReceipt

Table: `manufacturing_finishedgoodsreceipt`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| production_order | `production_order_id` | ForeignKey |  | FK -> manufacturing.ProductionOrder |
| product_name | `product_name` | CharField(200) |  |  |
| quantity_received | `quantity_received` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0.00')" |
| total_cost | `total_cost` | DecimalField |  | default: "Decimal('0.00')" |
| quantity_rejected | `quantity_rejected` | DecimalField |  | default: "Decimal('0.00')" |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| received_at | `received_at` | DateTimeField |  |  |
| received_by | `received_by_id` | ForeignKey | yes | FK -> accounts.User |
| notes | `notes` | CharField(500) |  | default: '' |

## manufacturing.InspectionResult

Table: `manufacturing_inspectionresult`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| quality_plan | `quality_plan_id` | ForeignKey | yes | FK -> manufacturing.QualityPlan |
| reference_type | `reference_type` | CharField(30) |  | default: '' |
| reference_id | `reference_id` | IntegerField | yes |  |
| product_name | `product_name` | CharField(200) |  |  |
| quantity_inspected | `quantity_inspected` | DecimalField |  | default: "Decimal('1')" |
| quantity_passed | `quantity_passed` | DecimalField |  | default: "Decimal('0')" |
| quantity_failed | `quantity_failed` | DecimalField |  | default: "Decimal('0')" |
| status | `status` | CharField(20) |  | choices: pending, passed, failed, conditional; default: 'pending' |
| notes | `notes` | TextField |  | default: '' |
| inspected_by | `inspected_by_id` | ForeignKey | yes | FK -> accounts.User |
| inspected_at | `inspected_at` | DateTimeField |  | default: 'datetime.datetime(2026, 11, 21, 8, 32, 5, 319567, tzinfo=datetime.timezone.utc)' |

## manufacturing.MaterialConsumption

Table: `manufacturing_materialconsumption`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| production_order | `production_order_id` | ForeignKey |  | FK -> manufacturing.ProductionOrder |
| component_name | `component_name` | CharField(200) |  |  |
| component_code | `component_code` | CharField(50) |  | default: '' |
| quantity_consumed | `quantity_consumed` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0.00')" |
| total_cost | `total_cost` | DecimalField |  | default: "Decimal('0.00')" |
| bom_line | `bom_line_id` | ForeignKey | yes | FK -> manufacturing.BOMLine |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| consumed_at | `consumed_at` | DateTimeField |  |  |
| consumed_by | `consumed_by_id` | ForeignKey | yes | FK -> accounts.User |
| notes | `notes` | CharField(500) |  | default: '' |

## manufacturing.NonConformance

Table: `manufacturing_nonconformance`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| nc_number | `nc_number` | CharField(50) |  |  |
| severity | `severity` | CharField(20) |  | choices: minor, major, critical; default: 'minor' |
| status | `status` | CharField(20) |  | choices: open, investigating, resolved, closed; default: 'open' |
| description | `description` | TextField |  |  |
| product_name | `product_name` | CharField(200) |  | default: '' |
| quantity_affected | `quantity_affected` | DecimalField |  | default: "Decimal('0')" |
| inspection_result | `inspection_result_id` | ForeignKey | yes | FK -> manufacturing.InspectionResult |
| production_order | `production_order_id` | ForeignKey | yes | FK -> manufacturing.ProductionOrder |
| reported_by | `reported_by_id` | ForeignKey | yes | FK -> accounts.User |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |
| root_cause | `root_cause` | TextField |  | default: '' |
| resolution | `resolution` | TextField |  | default: '' |
| resolved_at | `resolved_at` | DateTimeField | yes |  |

## manufacturing.ProductionOrder

Table: `manufacturing_productionorder`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| number | `number` | CharField(50) |  |  |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| quantity | `quantity` | DecimalField |  | default: "Decimal('1.00')" |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| bom | `bom_id` | ForeignKey | yes | FK -> manufacturing.BOM |
| routing | `routing_id` | ForeignKey | yes | FK -> manufacturing.Routing |
| start_date_jalali | `start_date_jalali` | CharField(10) |  | default: '' |
| end_date_jalali | `end_date_jalali` | CharField(10) |  | default: '' |
| start_date | `start_date` | DateField | yes |  |
| end_date | `end_date` | DateField | yes |  |
| status | `status` | CharField(20) |  | choices: draft, approved, released, started, paused, completed, cancelled; default: 'draft' |
| priority | `priority` | IntegerField |  | choices: 1, 2, 3, 4; default: 2 |
| material_cost | `material_cost` | DecimalField |  | default: "Decimal('0.00')" |
| labor_cost | `labor_cost` | DecimalField |  | default: "Decimal('0.00')" |
| machine_cost | `machine_cost` | DecimalField |  | default: "Decimal('0.00')" |
| overhead_cost | `overhead_cost` | DecimalField |  | default: "Decimal('0.00')" |
| total_cost | `total_cost` | DecimalField |  | default: "Decimal('0.00')" |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| approved_by | `approved_by_id` | ForeignKey | yes | FK -> accounts.User |
| approved_at | `approved_at` | DateTimeField | yes |  |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| description | `description` | TextField |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## manufacturing.QualityPlan

Table: `manufacturing_qualityplan`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| inspection_type | `inspection_type` | CharField(20) |  | choices: incoming, process, final; default: 'final' |
| product_name | `product_name` | CharField(200) |  | default: '' |
| product_code | `product_code` | CharField(50) |  | default: '' |
| bom | `bom_id` | ForeignKey | yes | FK -> manufacturing.BOM |
| routing | `routing_id` | ForeignKey | yes | FK -> manufacturing.Routing |
| criteria | `criteria` | JSONField |  | default: [] |
| is_active | `is_active` | BooleanField |  | default: True |

## manufacturing.Routing

Table: `manufacturing_routing`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| number | `number` | CharField(50) |  |  |
| name | `name` | CharField(200) |  |  |
| product_name | `product_name` | CharField(200) |  | default: '' |
| version | `version` | IntegerField |  | default: 1 |
| status | `status` | CharField(20) |  | choices: draft, active, obsolete; default: 'draft' |
| description | `description` | TextField |  | default: '' |
| estimated_hours | `estimated_hours` | DecimalField |  | default: "Decimal('0.00')" |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## manufacturing.RoutingOperation

Table: `manufacturing_routingoperation`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| routing | `routing_id` | ForeignKey |  | FK -> manufacturing.Routing |
| sequence | `sequence` | IntegerField |  |  |
| code | `code` | CharField(20) |  |  |
| name | `name` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| work_center | `work_center_id` | ForeignKey | yes | FK -> manufacturing.WorkCenter |
| setup_time_minutes | `setup_time_minutes` | IntegerField |  | default: 0 |
| run_time_minutes | `run_time_minutes` | IntegerField |  | default: 0 |
| labor_hours | `labor_hours` | DecimalField |  | default: "Decimal('0.00')" |
| machine_hours | `machine_hours` | DecimalField |  | default: "Decimal('0.00')" |
| is_quality_checkpoint | `is_quality_checkpoint` | BooleanField |  | default: False |
| notes | `notes` | CharField(500) |  | default: '' |

## manufacturing.WorkCenter

Table: `manufacturing_workcenter`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| code | `code` | CharField(20) |  |  |
| name | `name` | CharField(200) |  |  |
| work_center_type | `work_center_type` | CharField(20) |  | choices: machine, production_line, department, external_vendor; default: 'machine' |
| capacity | `capacity` | DecimalField |  | default: "Decimal('1.00')" |
| efficiency | `efficiency` | DecimalField |  | default: "Decimal('100.00')" |
| hourly_cost | `hourly_cost` | DecimalField |  | default: "Decimal('0.00')" |
| is_active | `is_active` | BooleanField |  | default: True |
| description | `description` | TextField |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## multi_tenant.Tenant

Table: `multi_tenant_tenant`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| plan | `plan_id` | ForeignKey | yes | FK -> multi_tenant.TenantPlan |
| subdomain | `subdomain` | CharField(63) | yes | unique |
| custom_domain | `custom_domain` | CharField(255) | yes |  |
| is_trial | `is_trial` | BooleanField |  | default: True |
| trial_ends_at | `trial_ends_at` | DateTimeField | yes |  |
| is_suspended | `is_suspended` | BooleanField |  | default: False |
| suspension_reason | `suspension_reason` | TextField |  | default: '' |
| current_users | `current_users` | PositiveIntegerField |  | default: 0 |
| storage_used_gb | `storage_used_gb` | DecimalField |  | default: 0 |
| onboarding_completed | `onboarding_completed` | BooleanField |  | default: False |
| last_active_at | `last_active_at` | DateTimeField | yes |  |
| settings | `settings` | JSONField |  | default: {} |

## multi_tenant.TenantFeature

Table: `multi_tenant_tenantfeature`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| tenant | `tenant_id` | ForeignKey |  | FK -> multi_tenant.Tenant |
| feature_key | `feature_key` | CharField(100) |  |  |
| feature_type | `feature_type` | CharField(20) |  | choices: module, capability, integration, ui; default: 'capability' |
| is_enabled | `is_enabled` | BooleanField |  | default: True |
| config | `config` | JSONField |  | default: {} |

## multi_tenant.TenantPlan

Table: `multi_tenant_tenantplan`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(100) |  | unique |
| plan_type | `plan_type` | CharField(20) |  | choices: free, starter, professional, enterprise; default: 'free' |
| description | `description` | TextField |  | default: '' |
| price_monthly | `price_monthly` | DecimalField |  | default: 0 |
| price_yearly | `price_yearly` | DecimalField |  | default: 0 |
| max_users | `max_users` | PositiveIntegerField |  | default: 5 |
| max_storage_gb | `max_storage_gb` | PositiveIntegerField |  | default: 1 |
| max_api_keys | `max_api_keys` | PositiveIntegerField |  | default: 2 |
| max_requests_per_minute | `max_requests_per_minute` | PositiveIntegerField |  | default: 60 |
| max_requests_per_hour | `max_requests_per_hour` | PositiveIntegerField |  | default: 1000 |
| enabled_modules | `enabled_modules` | JSONField |  | default: [] |
| features | `features` | JSONField |  | default: {} |
| is_active | `is_active` | BooleanField |  | default: True |

## multi_tenant.TenantSubscription

Table: `multi_tenant_tenantsubscription`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| tenant | `tenant_id` | ForeignKey |  | FK -> multi_tenant.Tenant |
| plan | `plan_id` | ForeignKey | yes | FK -> multi_tenant.TenantPlan |
| status | `status` | CharField(20) |  | choices: active, trialing, past_due, canceled, suspended; default: 'trialing' |
| billing_cycle | `billing_cycle` | CharField(20) |  | choices: monthly, yearly; default: 'monthly' |
| starts_at | `starts_at` | DateTimeField |  |  |
| ends_at | `ends_at` | DateTimeField |  |  |
| canceled_at | `canceled_at` | DateTimeField | yes |  |
| payment_method | `payment_method` | CharField(50) |  | default: '' |
| last_payment_at | `last_payment_at` | DateTimeField | yes |  |
| stripe_subscription_id | `stripe_subscription_id` | CharField(255) |  | default: '' |
| stripe_customer_id | `stripe_customer_id` | CharField(255) |  | default: '' |

## office.BusinessRecordReference

Table: `office_businessrecordreference`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| source_system | `source_system` | CharField(50) |  | default: 'nexivo_business' |
| entity_type | `entity_type` | CharField(20) |  | choices: customer, invoice, receipt, payment, opportunity |
| source_record_id | `source_record_id` | CharField(64) |  |  |
| display_snapshot | `display_snapshot` | JSONField |  | default: {} |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |

## office.Contract

Table: `office_contract`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| secretariat | `secretariat_id` | ForeignKey | yes | FK -> office.Secretariat |
| title | `title` | CharField(200) |  |  |
| contract_number | `contract_number` | CharField(100) |  | default: '' |
| counterparty | `counterparty` | CharField(200) |  |  |
| amount | `amount` | DecimalField | yes |  |
| currency | `currency` | CharField(5) |  | choices: IRR, IRT, USD, EUR; default: 'IRR' |
| start_date_jalali | `start_date_jalali` | CharField(10) |  | default: '' |
| end_date_jalali | `end_date_jalali` | CharField(10) |  | default: '' |
| description | `description` | TextField |  | default: '' |
| correspondence | `correspondence_id` | OneToOneField | yes | FK -> office.Correspondence; unique |

## office.Correspondence

Table: `office_correspondence`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| secretariat | `secretariat_id` | ForeignKey | yes | FK -> office.Secretariat |
| correspondence_type | `correspondence_type` | CharField(20) |  | choices: incoming, outgoing, internal, contract; default: 'internal' |
| registration_status | `registration_status` | CharField(20) |  | choices: draft, registered, cancelled; default: 'draft' |
| registration_number | `registration_number` | CharField(50) | yes |  |
| registration_year | `registration_year` | IntegerField | yes |  |
| registration_sequence | `registration_sequence` | IntegerField | yes |  |
| registered_at | `registered_at` | DateTimeField | yes |  |
| registered_by | `registered_by_id` | ForeignKey | yes | FK -> accounts.User |
| subject | `subject` | CharField(300) |  |  |
| body | `body` | TextField |  | default: '' |
| sender_type | `sender_type` | CharField(10) |  | choices: internal, external; default: 'internal' |
| sender_user | `sender_user_id` | ForeignKey | yes | FK -> accounts.User |
| sender_name | `sender_name` | CharField(200) |  | default: '' |
| sender_organization | `sender_organization` | CharField(200) |  | default: '' |
| sender_email | `sender_email` | CharField(254) |  | default: '' |
| letter_date | `letter_date` | DateField | yes |  |
| letter_date_jalali | `letter_date_jalali` | CharField(10) |  | default: '' |
| received_at | `received_at` | DateTimeField | yes |  |
| priority | `priority` | CharField(10) |  | choices: low, normal, high, urgent; default: 'normal' |
| confidentiality | `confidentiality` | CharField(20) |  | choices: normal, confidential, highly_confidential, restricted; default: 'normal' |
| current_status | `current_status` | CharField(20) |  | choices: open, in_progress, awaiting_reply, answered, closed; default: 'open' |
| due_at | `due_at` | DateTimeField | yes |  |
| owner | `owner_id` | ForeignKey | yes | FK -> accounts.User |
| parent_correspondence | `parent_correspondence_id` | ForeignKey | yes | FK -> office.Correspondence |
| archived_at | `archived_at` | DateTimeField | yes |  |

## office.CorrespondenceAction

Table: `office_correspondenceaction`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| correspondence | `correspondence_id` | ForeignKey |  | FK -> office.Correspondence |
| actor | `actor_id` | ForeignKey | yes | FK -> accounts.User |
| action | `action` | CharField(30) |  |  |
| note | `note` | TextField |  | default: '' |
| metadata | `metadata` | JSONField |  | default: {} |
| created_at | `created_at` | DateTimeField |  |  |

## office.CorrespondenceAttachment

Table: `office_correspondenceattachment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| correspondence | `correspondence_id` | ForeignKey |  | FK -> office.Correspondence |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| file | `file` | FileField(255) |  |  |
| original_name | `original_name` | CharField(255) |  |  |
| content_type | `content_type` | CharField(100) |  | default: '' |
| size_bytes | `size_bytes` | PositiveBigIntegerField |  | default: 0 |
| checksum | `checksum` | CharField(64) |  | default: '' |
| uploaded_by | `uploaded_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |

## office.CorrespondenceComment

Table: `office_correspondencecomment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| correspondence | `correspondence_id` | ForeignKey |  | FK -> office.Correspondence |
| author | `author_id` | ForeignKey | yes | FK -> accounts.User |
| body | `body` | TextField |  |  |
| is_internal | `is_internal` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## office.CorrespondenceRecipient

Table: `office_correspondencerecipient`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| correspondence | `correspondence_id` | ForeignKey |  | FK -> office.Correspondence |
| recipient_type | `recipient_type` | CharField(10) |  | choices: user, team, division, external; default: 'user' |
| recipient_user | `recipient_user_id` | ForeignKey | yes | FK -> accounts.User |
| recipient_team | `recipient_team_id` | ForeignKey | yes | FK -> accounts.Team |
| recipient_division | `recipient_division_id` | ForeignKey | yes | FK -> accounts.Division |
| external_name | `external_name` | CharField(200) |  | default: '' |
| external_email | `external_email` | CharField(254) |  | default: '' |
| delivery_type | `delivery_type` | CharField(20) |  | choices: primary, cc, bcc, action_required, information; default: 'primary' |
| delivery_status | `delivery_status` | CharField(20) |  | choices: pending, delivered, read; default: 'pending' |
| delivered_at | `delivered_at` | DateTimeField | yes |  |
| read_at | `read_at` | DateTimeField | yes |  |

## office.CorrespondenceRoute

Table: `office_correspondenceroute`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| correspondence | `correspondence_id` | ForeignKey |  | FK -> office.Correspondence |
| from_user | `from_user_id` | ForeignKey | yes | FK -> accounts.User |
| to_user | `to_user_id` | ForeignKey | yes | FK -> accounts.User |
| to_team | `to_team_id` | ForeignKey | yes | FK -> accounts.Team |
| to_division | `to_division_id` | ForeignKey | yes | FK -> accounts.Division |
| route_type | `route_type` | CharField(20) |  | choices: action, review, information, signature, response; default: 'action' |
| instruction | `instruction` | TextField |  | default: '' |
| assigned_at | `assigned_at` | DateTimeField |  |  |
| due_at | `due_at` | DateTimeField | yes |  |
| accepted_at | `accepted_at` | DateTimeField | yes |  |
| completed_at | `completed_at` | DateTimeField | yes |  |
| route_status | `route_status` | CharField(20) |  | choices: pending, accepted, completed, cancelled; default: 'pending' |

## office.OfficeBusinessLink

Table: `office_officebusinesslink`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| office_object_type | `office_object_type` | CharField(30) |  | default: 'correspondence' |
| office_object_id | `office_object_id` | CharField(64) |  |  |
| reference | `reference_id` | ForeignKey |  | FK -> office.BusinessRecordReference |
| relationship_type | `relationship_type` | CharField(30) |  | choices: about, concerns, invoice_for, payment_for, customer_context, supporting_evidence, follow_up_to, discussed_in; default: 'about' |
| label | `label` | CharField(200) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |

## office.Secretariat

Table: `office_secretariat`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(150) |  |  |
| code | `code` | CharField(20) |  |  |
| is_active | `is_active` | BooleanField |  | default: True |
| number_pattern | `number_pattern` | CharField(120) |  | default: '{year}/{code}/{type}/{seq}' |
| sequence_padding | `sequence_padding` | PositiveSmallIntegerField |  | default: 6 |
| persian_digits | `persian_digits` | BooleanField |  | default: False |
| type_letters | `type_letters` | JSONField |  | default: {} |

## office.SecretariatMember

Table: `office_secretariatmember`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| secretariat | `secretariat_id` | ForeignKey |  | FK -> office.Secretariat |
| user | `user_id` | ForeignKey |  | FK -> accounts.User |
| can_register | `can_register` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## office.SecretariatNumberSequence

Table: `office_secretariatnumbersequence`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| secretariat | `secretariat_id` | ForeignKey |  | FK -> office.Secretariat |
| correspondence_type | `correspondence_type` | CharField(20) |  |  |
| year | `year` | IntegerField |  |  |
| last_number | `last_number` | IntegerField |  | default: 0 |

## purchasing.GoodsReceipt

Table: `purchasing_goodsreceipt`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| receipt_number | `receipt_number` | CharField(50) |  |  |
| purchase_order | `purchase_order_id` | ForeignKey |  | FK -> purchasing.PurchaseOrder |
| item_name | `item_name` | CharField(200) |  |  |
| quantity_ordered | `quantity_ordered` | DecimalField |  | default: "Decimal('0')" |
| quantity_received | `quantity_received` | DecimalField |  | default: "Decimal('0')" |
| quantity_rejected | `quantity_rejected` | DecimalField |  | default: "Decimal('0')" |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0')" |
| inspection_notes | `inspection_notes` | TextField |  | default: '' |
| inspected_by | `inspected_by_id` | ForeignKey | yes | FK -> accounts.User |
| inspection_date | `inspection_date` | DateField | yes |  |
| warehouse_code | `warehouse_code` | CharField(20) |  | default: '' |
| location_code | `location_code` | CharField(30) |  | default: '' |
| status | `status` | CharField(20) |  | choices: draft, inspected, approved, posted, returned; default: 'draft' |
| received_by | `received_by_id` | ForeignKey | yes | FK -> accounts.User |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |

## purchasing.PurchaseOrder

Table: `purchasing_purchaseorder`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| order_number | `order_number` | CharField(50) |  |  |
| request | `request_id` | ForeignKey | yes | FK -> purchasing.PurchaseRequest |
| supplier_name | `supplier_name` | CharField(200) |  | default: '' |
| supplier_code | `supplier_code` | CharField(50) |  | default: '' |
| supplier_reference | `supplier_reference` | CharField(100) |  | default: '' |
| order_date_jalali | `order_date_jalali` | CharField(10) |  | default: '' |
| order_date | `order_date` | DateField |  |  |
| delivery_date_jalali | `delivery_date_jalali` | CharField(10) |  | default: '' |
| delivery_date | `delivery_date` | DateField | yes |  |
| item_name | `item_name` | CharField(200) |  |  |
| item_code | `item_code` | CharField(50) |  | default: '' |
| description | `description` | TextField |  | default: '' |
| quantity | `quantity` | DecimalField |  | default: "Decimal('1')" |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_price | `unit_price` | DecimalField |  | default: "Decimal('0')" |
| discount | `discount` | DecimalField |  | default: "Decimal('0')" |
| tax_rate | `tax_rate` | DecimalField |  | default: "Decimal('10.00')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| total | `total` | DecimalField |  | default: "Decimal('0')" |
| status | `status` | CharField(20) |  | choices: draft, submitted, approved, confirmed, partially_received, received, closed, cancelled; default: 'draft' |
| notes | `notes` | TextField |  | default: '' |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| approved_by | `approved_by_id` | ForeignKey | yes | FK -> accounts.User |
| approved_at | `approved_at` | DateTimeField | yes |  |

## purchasing.PurchaseRequest

Table: `purchasing_purchaserequest`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| request_number | `request_number` | CharField(50) |  |  |
| title | `title` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| requested_by | `requested_by_id` | ForeignKey | yes | FK -> accounts.User |
| department | `department` | CharField(100) |  | default: '' |
| item_name | `item_name` | CharField(200) |  |  |
| item_code | `item_code` | CharField(50) |  | default: '' |
| quantity | `quantity` | DecimalField |  | default: "Decimal('1')" |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| estimated_unit_cost | `estimated_unit_cost` | DecimalField |  | default: "Decimal('0')" |
| estimated_total | `estimated_total` | DecimalField |  | default: "Decimal('0')" |
| priority | `priority` | IntegerField |  | choices: 1, 2, 3, 4; default: 2 |
| needed_by_date | `needed_by_date` | DateField | yes |  |
| status | `status` | CharField(20) |  | choices: draft, submitted, approved, rejected, converted, cancelled; default: 'draft' |
| approved_by | `approved_by_id` | ForeignKey | yes | FK -> accounts.User |
| approved_at | `approved_at` | DateTimeField | yes |  |
| rejection_reason | `rejection_reason` | CharField(500) |  | default: '' |

## purchasing.PurchaseReturn

Table: `purchasing_purchasereturn`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| return_number | `return_number` | CharField(50) |  |  |
| goods_receipt | `goods_receipt_id` | ForeignKey | yes | FK -> purchasing.GoodsReceipt |
| purchase_order | `purchase_order_id` | ForeignKey |  | FK -> purchasing.PurchaseOrder |
| item_name | `item_name` | CharField(200) |  |  |
| quantity_returned | `quantity_returned` | DecimalField |  | default: "Decimal('0')" |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0')" |
| total_value | `total_value` | DecimalField |  | default: "Decimal('0')" |
| reason | `reason` | CharField(500) |  | default: '' |
| status | `status` | CharField(20) |  | choices: draft, approved, shipped, completed; default: 'draft' |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |

## rate_limiting.APIKey

Table: `rate_limiting_apikey`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(100) |  |  |
| key_hash | `key_hash` | CharField(64) |  | unique |
| key_prefix | `key_prefix` | CharField(15) |  |  |
| is_active | `is_active` | BooleanField |  | default: True |
| scopes | `scopes` | JSONField |  | default: [] |
| allowed_modules | `allowed_modules` | JSONField |  | default: [] |
| rate_limit_override | `rate_limit_override` | JSONField | yes |  |
| expires_at | `expires_at` | DateTimeField | yes |  |
| last_used_at | `last_used_at` | DateTimeField | yes |  |
| total_requests | `total_requests` | PositiveIntegerField |  | default: 0 |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |

## rate_limiting.RateLimitLog

Table: `rate_limiting_ratelimitlog`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| api_key | `api_key_id` | ForeignKey | yes | FK -> rate_limiting.APIKey |
| user | `user_id` | ForeignKey | yes | FK -> accounts.User |
| method | `method` | CharField(10) |  |  |
| path | `path` | CharField(500) |  |  |
| endpoint_name | `endpoint_name` | CharField(200) |  | default: '' |
| module | `module` | CharField(50) |  | default: '' |
| status_code | `status_code` | PositiveIntegerField |  |  |
| response_time_ms | `response_time_ms` | PositiveIntegerField | yes |  |
| rate_limit_remaining | `rate_limit_remaining` | IntegerField | yes |  |
| rate_limit_limit | `rate_limit_limit` | IntegerField | yes |  |
| was_throttled | `was_throttled` | BooleanField |  | default: False |
| ip_address | `ip_address` | GenericIPAddressField(39) | yes |  |
| user_agent | `user_agent` | CharField(500) |  | default: '' |
| timestamp | `timestamp` | DateTimeField |  | default: 'datetime.datetime(2026, 11, 21, 8, 32, 5, 324726, tzinfo=datetime.timezone.utc)' |

## rate_limiting.RateLimitPolicy

Table: `rate_limiting_ratelimitpolicy`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(100) |  |  |
| description | `description` | TextField |  | default: '' |
| is_active | `is_active` | BooleanField |  | default: True |
| scope | `scope` | CharField(20) |  | choices: global, module, endpoint, api_key; default: 'global' |
| module | `module` | CharField(50) |  | default: '' |
| endpoint_pattern | `endpoint_pattern` | CharField(255) |  | default: '' |
| requests_per_minute | `requests_per_minute` | PositiveIntegerField |  | default: 60 |
| requests_per_hour | `requests_per_hour` | PositiveIntegerField |  | default: 1000 |
| requests_per_day | `requests_per_day` | PositiveIntegerField |  | default: 10000 |
| burst_size | `burst_size` | PositiveIntegerField |  | default: 10 |
| retry_after_seconds | `retry_after_seconds` | PositiveIntegerField |  | default: 60 |
| priority | `priority` | IntegerField |  | default: 0 |

## reporting.Dashboard

Table: `reporting_dashboard`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| layout_config | `layout_config` | JSONField |  | default: {} |
| is_default | `is_default` | BooleanField |  | default: False |
| is_public | `is_public` | BooleanField |  | default: False |
| refresh_interval | `refresh_interval` | PositiveIntegerField |  | default: 300 |
| allowed_roles | `allowed_roles` | JSONField |  | default: [] |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |

## reporting.DashboardWidget

Table: `reporting_dashboardwidget`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| dashboard | `dashboard_id` | ForeignKey |  | FK -> reporting.Dashboard |
| report_template | `report_template_id` | ForeignKey | yes | FK -> reporting.ReportTemplate |
| title | `title` | CharField(200) |  |  |
| chart_type | `chart_type` | CharField(50) |  | choices: line, bar, stacked_bar, pie, donut, area, scatter, heatmap, treemap, gauge, funnel, kpi, table, pivot; default: 'bar' |
| query_config | `query_config` | JSONField |  | default: {} |
| position_x | `position_x` | PositiveIntegerField |  | default: 0 |
| position_y | `position_y` | PositiveIntegerField |  | default: 0 |
| width | `width` | PositiveIntegerField |  | default: 6 |
| height | `height` | PositiveIntegerField |  | default: 4 |
| config | `config` | JSONField |  | default: {} |
| refresh_interval | `refresh_interval` | PositiveIntegerField |  | default: 0 |

## reporting.KPI

Table: `reporting_kpi`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| code | `code` | SlugField(100) |  | unique |
| description | `description` | TextField |  | default: '' |
| module | `module` | CharField(50) |  | choices: finance, inventory, purchasing, sales, manufacturing, trading, service_sales, service_management, crm, hr, cross_module; default: 'cross_module' |
| formula | `formula` | TextField |  |  |
| unit | `unit` | CharField(50) |  | default: '' |
| target_value | `target_value` | DecimalField |  | default: 0 |
| current_value | `current_value` | DecimalField |  | default: 0 |
| previous_value | `previous_value` | DecimalField |  | default: 0 |
| trend | `trend` | CharField(20) |  | choices: up, down, stable; default: 'stable' |
| is_active | `is_active` | BooleanField |  | default: True |
| display_order | `display_order` | PositiveIntegerField |  | default: 0 |

## reporting.ReportExecution

Table: `reporting_reportexecution`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| template | `template_id` | ForeignKey |  | FK -> reporting.ReportTemplate |
| parameters | `parameters` | JSONField |  | default: {} |
| status | `status` | CharField(20) |  | choices: pending, running, completed, failed; default: 'pending' |
| result_data | `result_data` | JSONField |  | default: {} |
| row_count | `row_count` | PositiveIntegerField |  | default: 0 |
| execution_time_ms | `execution_time_ms` | PositiveIntegerField |  | default: 0 |
| error_message | `error_message` | TextField |  | default: '' |
| executed_by | `executed_by_id` | ForeignKey | yes | FK -> accounts.User |

## reporting.ReportSnapshot

Table: `reporting_reportsnapshot`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| template | `template_id` | ForeignKey |  | FK -> reporting.ReportTemplate |
| execution | `execution_id` | ForeignKey | yes | FK -> reporting.ReportExecution |
| parameters | `parameters` | JSONField |  | default: {} |
| result_data | `result_data` | JSONField |  | default: {} |
| row_count | `row_count` | PositiveIntegerField |  | default: 0 |
| file_path | `file_path` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |

## reporting.ReportTemplate

Table: `reporting_reporttemplate`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| module | `module` | CharField(50) |  | choices: finance, inventory, purchasing, sales, manufacturing, trading, service_sales, service_management, crm, hr, cross_module; default: 'cross_module' |
| visualization | `visualization` | CharField(50) |  | choices: table, chart_bar, chart_line, chart_pie, chart_area, kpi, pivot; default: 'table' |
| query_config | `query_config` | JSONField |  | default: {} |
| parameters_schema | `parameters_schema` | JSONField |  | default: [] |
| is_public | `is_public` | BooleanField |  | default: False |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |

## reporting.ScheduledReport

Table: `reporting_scheduledreport`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| template | `template_id` | ForeignKey |  | FK -> reporting.ReportTemplate |
| name | `name` | CharField(200) |  |  |
| frequency | `frequency` | CharField(20) |  | choices: hourly, daily, weekly, monthly, quarterly; default: 'daily' |
| cron_expression | `cron_expression` | CharField(100) |  | default: '' |
| parameters | `parameters` | JSONField |  | default: {} |
| recipients | `recipients` | JSONField |  | default: [] |
| export_format | `export_format` | CharField(20) |  | choices: pdf, xlsx, csv; default: 'pdf' |
| is_active | `is_active` | BooleanField |  | default: True |
| last_run_at | `last_run_at` | DateTimeField | yes |  |
| next_run_at | `next_run_at` | DateTimeField | yes |  |

## sales.SalesInvoice

Table: `sales_salesinvoice`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| invoice_number | `invoice_number` | CharField(50) |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| sales_order | `sales_order_id` | ForeignKey | yes | FK -> sales.SalesOrder |
| invoice_date | `invoice_date` | DateField |  |  |
| due_date | `due_date` | DateField |  |  |
| subtotal | `subtotal` | DecimalField |  | default: "Decimal('0')" |
| discount_amount | `discount_amount` | DecimalField |  | default: "Decimal('0')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| total | `total` | DecimalField |  | default: "Decimal('0')" |
| amount_paid | `amount_paid` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| exchange_rate | `exchange_rate` | DecimalField |  | default: "Decimal('1')" |
| status | `status` | CharField(20) |  | choices: draft, issued, sent, paid, partial, overdue, cancelled; default: 'draft' |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| notes | `notes` | TextField |  | default: '' |

## sales.SalesInvoiceLine

Table: `sales_salesinvoiceline`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| invoice | `invoice_id` | ForeignKey |  | FK -> sales.SalesInvoice |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| description | `description` | CharField(500) |  | default: '' |
| quantity | `quantity` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_price | `unit_price` | DecimalField |  |  |
| discount_percent | `discount_percent` | DecimalField |  | default: "Decimal('0')" |
| discount_amount | `discount_amount` | DecimalField |  | default: "Decimal('0')" |
| tax_percent | `tax_percent` | DecimalField |  | default: "Decimal('0')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| line_total | `line_total` | DecimalField |  | default: "Decimal('0')" |

## sales.SalesOrder

Table: `sales_salesorder`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| order_number | `order_number` | CharField(50) |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| warehouse | `warehouse_id` | ForeignKey | yes | FK -> inventory.Warehouse |
| order_date | `order_date` | DateField |  |  |
| delivery_date | `delivery_date` | DateField | yes |  |
| subtotal | `subtotal` | DecimalField |  | default: "Decimal('0')" |
| discount_amount | `discount_amount` | DecimalField |  | default: "Decimal('0')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| total | `total` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| exchange_rate | `exchange_rate` | DecimalField |  | default: "Decimal('1')" |
| status | `status` | CharField(20) |  | choices: draft, confirmed, processing, partially_delivered, delivered, invoiced, completed, cancelled; default: 'draft' |
| payment_terms | `payment_terms` | CharField(200) |  | default: '' |
| notes | `notes` | TextField |  | default: '' |
| source_quotation | `source_quotation_id` | ForeignKey | yes | FK -> sales.SalesQuotation |

## sales.SalesOrderLine

Table: `sales_salesorderline`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| order | `order_id` | ForeignKey |  | FK -> sales.SalesOrder |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| description | `description` | CharField(500) |  | default: '' |
| quantity | `quantity` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_price | `unit_price` | DecimalField |  |  |
| discount_percent | `discount_percent` | DecimalField |  | default: "Decimal('0')" |
| discount_amount | `discount_amount` | DecimalField |  | default: "Decimal('0')" |
| tax_percent | `tax_percent` | DecimalField |  | default: "Decimal('0')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| line_total | `line_total` | DecimalField |  | default: "Decimal('0')" |
| quantity_delivered | `quantity_delivered` | DecimalField |  | default: "Decimal('0')" |
| quantity_invoiced | `quantity_invoiced` | DecimalField |  | default: "Decimal('0')" |

## sales.SalesQuotation

Table: `sales_salesquotation`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| quotation_number | `quotation_number` | CharField(50) |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| quotation_date | `quotation_date` | DateField |  |  |
| valid_until | `valid_until` | DateField |  |  |
| subtotal | `subtotal` | DecimalField |  | default: "Decimal('0')" |
| discount_amount | `discount_amount` | DecimalField |  | default: "Decimal('0')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| total | `total` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| exchange_rate | `exchange_rate` | DecimalField |  | default: "Decimal('1')" |
| status | `status` | CharField(20) |  | choices: draft, sent, approved, rejected, expired, converted; default: 'draft' |
| notes | `notes` | TextField |  | default: '' |
| terms | `terms` | TextField |  | default: '' |
| converted_order | `converted_order_id` | ForeignKey | yes | FK -> sales.SalesOrder |

## sales.SalesQuotationLine

Table: `sales_salesquotationline`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| quotation | `quotation_id` | ForeignKey |  | FK -> sales.SalesQuotation |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| description | `description` | CharField(500) |  | default: '' |
| quantity | `quantity` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_price | `unit_price` | DecimalField |  |  |
| discount_percent | `discount_percent` | DecimalField |  | default: "Decimal('0')" |
| discount_amount | `discount_amount` | DecimalField |  | default: "Decimal('0')" |
| tax_percent | `tax_percent` | DecimalField |  | default: "Decimal('0')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| line_total | `line_total` | DecimalField |  | default: "Decimal('0')" |

## sales.SalesReturn

Table: `sales_salesreturn`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| return_number | `return_number` | CharField(50) |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| sales_invoice | `sales_invoice_id` | ForeignKey | yes | FK -> sales.SalesInvoice |
| sales_order | `sales_order_id` | ForeignKey | yes | FK -> sales.SalesOrder |
| return_date | `return_date` | DateField |  |  |
| reason | `reason` | CharField(500) |  | default: '' |
| total_amount | `total_amount` | DecimalField |  | default: "Decimal('0')" |
| restocking_fee | `restocking_fee` | DecimalField |  | default: "Decimal('0')" |
| net_amount | `net_amount` | DecimalField |  | default: "Decimal('0')" |
| status | `status` | CharField(20) |  | choices: draft, received, approved, credited, cancelled; default: 'draft' |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| notes | `notes` | TextField |  | default: '' |

## sales.SalesReturnLine

Table: `sales_salesreturnline`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| return_order | `return_order_id` | ForeignKey |  | FK -> sales.SalesReturn |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| quantity | `quantity` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_price | `unit_price` | DecimalField |  |  |
| line_total | `line_total` | DecimalField |  | default: "Decimal('0')" |
| reason | `reason` | CharField(500) |  | default: '' |
| is_defective | `is_defective` | BooleanField |  | default: False |

## service_management.MaintenancePlan

Table: `service_management_maintenanceplan`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| product_name | `product_name` | CharField(200) |  | default: '' |
| product_code | `product_code` | CharField(50) |  | default: '' |
| maintenance_type | `maintenance_type` | CharField(20) |  | choices: time_based, usage_based, condition_based; default: 'time_based' |
| status | `status` | CharField(20) |  | choices: draft, active, paused, completed; default: 'draft' |
| interval_days | `interval_days` | IntegerField |  | default: 90 |
| last_maintenance_date | `last_maintenance_date` | DateField | yes |  |
| next_maintenance_date | `next_maintenance_date` | DateField | yes |  |
| checklist | `checklist` | TextField |  | default: '' |
| estimated_cost | `estimated_cost` | DecimalField |  | default: "Decimal('0.00')" |
| assigned_technician | `assigned_technician_id` | ForeignKey | yes | FK -> service_management.Technician |

## service_management.MaintenanceSchedule

Table: `service_management_maintenanceschedule`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| plan | `plan_id` | ForeignKey |  | FK -> service_management.MaintenancePlan |
| scheduled_date | `scheduled_date` | DateField |  |  |
| completed_date | `completed_date` | DateField | yes |  |
| work_order | `work_order_id` | ForeignKey | yes | FK -> service_management.WorkOrder |
| status | `status` | CharField(20) |  | default: 'scheduled' |

## service_management.SLARule

Table: `service_management_slarule`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| priority | `priority` | CharField(20) |  | choices: low, medium, high, critical; default: 'medium' |
| response_time_hours | `response_time_hours` | IntegerField |  | default: 24 |
| resolution_time_hours | `resolution_time_hours` | IntegerField |  | default: 72 |
| working_hours_start | `working_hours_start` | IntegerField |  | default: 8 |
| working_hours_end | `working_hours_end` | IntegerField |  | default: 17 |
| escalate_after_hours | `escalate_after_hours` | IntegerField | yes |  |
| is_active | `is_active` | BooleanField |  | default: True |

## service_management.ServiceContract

Table: `service_management_servicecontract`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| contract_number | `contract_number` | CharField(50) |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| contract_type | `contract_type` | CharField(20) |  | choices: maintenance, support, amc, subscription; default: 'maintenance' |
| status | `status` | CharField(20) |  | choices: draft, active, expired, cancelled; default: 'draft' |
| start_date | `start_date` | DateField |  |  |
| end_date | `end_date` | DateField |  |  |
| coverage_description | `coverage_description` | TextField |  | default: '' |
| sla_level | `sla_level` | CharField(20) |  | default: 'standard' |
| price | `price` | DecimalField |  | default: "Decimal('0.00')" |
| billing_cycle | `billing_cycle` | CharField(20) |  | choices: monthly, quarterly, annually, one_time; default: 'monthly' |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| notes | `notes` | TextField |  | default: '' |

## service_management.ServiceFeedback

Table: `service_management_servicefeedback`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| work_order | `work_order_id` | OneToOneField |  | FK -> service_management.WorkOrder; unique |
| rating | `rating` | IntegerField |  | default: 5 |
| comment | `comment` | TextField |  | default: '' |
| created_date | `created_date` | DateTimeField |  |  |

## service_management.ServicePart

Table: `service_management_servicepart`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| work_order | `work_order_id` | ForeignKey |  | FK -> service_management.WorkOrder |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| quantity | `quantity` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_cost | `unit_cost` | DecimalField |  | default: "Decimal('0.00')" |
| total_cost | `total_cost` | DecimalField |  | default: "Decimal('0.00')" |
| inventory_movement | `inventory_movement_id` | ForeignKey | yes | FK -> inventory.StockMovement |
| notes | `notes` | CharField(500) |  | default: '' |

## service_management.ServiceRequest

Table: `service_management_servicerequest`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| request_number | `request_number` | CharField(50) |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| serial_number | `serial_number` | CharField(100) |  | default: '' |
| problem_description | `problem_description` | TextField |  | default: '' |
| priority | `priority` | CharField(20) |  | choices: low, medium, high, critical; default: 'medium' |
| status | `status` | CharField(20) |  | choices: new, assigned, in_progress, waiting_customer, waiting_parts, completed, closed, cancelled; default: 'new' |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |
| assigned_technician | `assigned_technician_id` | ForeignKey | yes | FK -> service_management.Technician |
| warranty | `warranty_id` | ForeignKey | yes | FK -> service_management.Warranty |
| received_date | `received_date` | DateTimeField |  |  |
| resolved_date | `resolved_date` | DateTimeField | yes |  |
| closed_date | `closed_date` | DateTimeField | yes |  |
| sla_response_deadline | `sla_response_deadline` | DateTimeField | yes |  |
| sla_resolution_deadline | `sla_resolution_deadline` | DateTimeField | yes |  |
| sla_response_met | `sla_response_met` | BooleanField | yes |  |
| sla_resolution_met | `sla_resolution_met` | BooleanField | yes |  |
| is_chargeable | `is_chargeable` | BooleanField |  | default: False |
| service_invoice | `service_invoice_id` | ForeignKey | yes | FK -> sales.SalesInvoice |
| notes | `notes` | TextField |  | default: '' |

## service_management.Technician

Table: `service_management_technician`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| user | `user_id` | OneToOneField | yes | FK -> accounts.User; unique |
| name | `name` | CharField(200) |  |  |
| employee_id | `employee_id` | CharField(50) |  | default: '' |
| department | `department` | CharField(100) |  | default: '' |
| phone | `phone` | CharField(20) |  | default: '' |
| skills | `skills` | CharField(500) |  | default: '' |
| hourly_rate | `hourly_rate` | DecimalField |  | default: "Decimal('0.00')" |
| is_active | `is_active` | BooleanField |  | default: True |
| performance_score | `performance_score` | DecimalField |  | default: "Decimal('100.00')" |

## service_management.Warranty

Table: `service_management_warranty`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| serial_number | `serial_number` | CharField(100) |  | default: '' |
| warranty_type | `warranty_type` | CharField(20) |  | choices: manufacturer, dealer, extended, contract; default: 'manufacturer' |
| status | `status` | CharField(20) |  | choices: active, expired, voided; default: 'active' |
| start_date | `start_date` | DateField |  |  |
| end_date | `end_date` | DateField |  |  |
| notes | `notes` | TextField |  | default: '' |

## service_management.WorkOrder

Table: `service_management_workorder`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| work_order_number | `work_order_number` | CharField(50) |  |  |
| service_request | `service_request_id` | ForeignKey |  | FK -> service_management.ServiceRequest |
| technician | `technician_id` | ForeignKey | yes | FK -> service_management.Technician |
| problem | `problem` | TextField |  | default: '' |
| diagnosis | `diagnosis` | TextField |  | default: '' |
| resolution | `resolution` | TextField |  | default: '' |
| required_parts | `required_parts` | TextField |  | default: '' |
| estimated_cost | `estimated_cost` | DecimalField |  | default: "Decimal('0.00')" |
| actual_labor_cost | `actual_labor_cost` | DecimalField |  | default: "Decimal('0.00')" |
| actual_parts_cost | `actual_parts_cost` | DecimalField |  | default: "Decimal('0.00')" |
| actual_external_cost | `actual_external_cost` | DecimalField |  | default: "Decimal('0.00')" |
| actual_overhead | `actual_overhead` | DecimalField |  | default: "Decimal('0.00')" |
| actual_total_cost | `actual_total_cost` | DecimalField |  | default: "Decimal('0.00')" |
| estimated_hours | `estimated_hours` | DecimalField |  | default: "Decimal('0.00')" |
| actual_hours | `actual_hours` | DecimalField |  | default: "Decimal('0.00')" |
| status | `status` | CharField(20) |  | choices: created, assigned, started, paused, completed, approved, closed; default: 'created' |
| start_date | `start_date` | DateTimeField | yes |  |
| completed_date | `completed_date` | DateTimeField | yes |  |
| approved_date | `approved_date` | DateTimeField | yes |  |
| notes | `notes` | TextField |  | default: '' |

## service_management.WorkOrderOperation

Table: `service_management_workorderoperation`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| work_order | `work_order_id` | ForeignKey |  | FK -> service_management.WorkOrder |
| sequence | `sequence` | IntegerField |  | default: 1 |
| name | `name` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| labor_hours | `labor_hours` | DecimalField |  | default: "Decimal('0.00')" |
| parts_used | `parts_used` | TextField |  | default: '' |
| status | `status` | CharField(20) |  | default: 'pending' |
| completed_at | `completed_at` | DateTimeField | yes |  |

## service_sales.Booking

Table: `service_sales_booking`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| booking_number | `booking_number` | CharField(50) |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| booking_date | `booking_date` | DateField |  |  |
| status | `status` | CharField(20) |  | choices: draft, reserved, confirmed, paid, completed, cancelled, refunded; default: 'draft' |
| subtotal | `subtotal` | DecimalField |  | default: "Decimal('0')" |
| discount_amount | `discount_amount` | DecimalField |  | default: "Decimal('0')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| total | `total` | DecimalField |  | default: "Decimal('0')" |
| amount_paid | `amount_paid` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| notes | `notes` | TextField |  | default: '' |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |

## service_sales.BookingLine

Table: `service_sales_bookingline`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| booking | `booking_id` | ForeignKey |  | FK -> service_sales.Booking |
| service | `service_id` | ForeignKey |  | FK -> service_sales.Service |
| description | `description` | CharField(500) |  | default: '' |
| quantity | `quantity` | DecimalField |  | default: "Decimal('1')" |
| unit_price | `unit_price` | DecimalField |  | default: "Decimal('0')" |
| discount_percent | `discount_percent` | DecimalField |  | default: "Decimal('0')" |
| discount_amount | `discount_amount` | DecimalField |  | default: "Decimal('0')" |
| tax_percent | `tax_percent` | DecimalField |  | default: "Decimal('0')" |
| tax_amount | `tax_amount` | DecimalField |  | default: "Decimal('0')" |
| line_total | `line_total` | DecimalField |  | default: "Decimal('0')" |
| supplier_cost | `supplier_cost` | DecimalField |  | default: "Decimal('0')" |

## service_sales.CommissionRule

Table: `service_sales_commissionrule`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| service_type | `service_type` | CharField(20) |  | choices: flight, hotel, tour, insurance, consulting, subscription, training, other; default: '' |
| commission_type | `commission_type` | CharField(20) |  | choices: percentage, fixed, margin_based; default: 'percentage' |
| commission_rate | `commission_rate` | DecimalField |  | default: "Decimal('0')" |
| fixed_amount | `fixed_amount` | DecimalField |  | default: "Decimal('0')" |
| applies_to_role | `applies_to_role` | CharField(50) |  | default: '' |
| is_active | `is_active` | BooleanField |  | default: True |

## service_sales.CommissionTransaction

Table: `service_sales_commissiontransaction`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| booking | `booking_id` | ForeignKey |  | FK -> service_sales.Booking |
| rule | `rule_id` | ForeignKey | yes | FK -> service_sales.CommissionRule |
| agent | `agent_id` | ForeignKey | yes | FK -> accounts.User |
| commission_amount | `commission_amount` | DecimalField |  | default: "Decimal('0')" |
| base_amount | `base_amount` | DecimalField |  | default: "Decimal('0')" |
| status | `status` | CharField(20) |  | choices: pending, approved, paid; default: 'pending' |
| notes | `notes` | TextField |  | default: '' |

## service_sales.HotelReservation

Table: `service_sales_hotelreservation`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| booking | `booking_id` | ForeignKey |  | FK -> service_sales.Booking |
| hotel_name | `hotel_name` | CharField(200) |  |  |
| room_type | `room_type` | CharField(50) |  | default: 'standard' |
| check_in | `check_in` | DateField |  |  |
| check_out | `check_out` | DateField |  |  |
| nights | `nights` | IntegerField |  | default: 1 |
| guests | `guests` | IntegerField |  | default: 1 |
| room_rate | `room_rate` | DecimalField |  | default: "Decimal('0')" |
| total_rate | `total_rate` | DecimalField |  | default: "Decimal('0')" |
| special_requests | `special_requests` | TextField |  | default: '' |

## service_sales.Passenger

Table: `service_sales_passenger`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| booking | `booking_id` | ForeignKey |  | FK -> service_sales.Booking |
| first_name | `first_name` | CharField(100) |  |  |
| last_name | `last_name` | CharField(100) |  |  |
| passport_number | `passport_number` | CharField(50) |  | default: '' |
| national_id | `national_id` | CharField(20) |  | default: '' |
| date_of_birth | `date_of_birth` | DateField | yes |  |
| gender | `gender` | CharField(10) |  | choices: M, F; default: 'M' |
| seat_class | `seat_class` | CharField(20) |  | choices: economy, business, first; default: 'economy' |

## service_sales.RefundTransaction

Table: `service_sales_refundtransaction`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| booking | `booking_id` | ForeignKey |  | FK -> service_sales.Booking |
| refund_amount | `refund_amount` | DecimalField |  | default: "Decimal('0')" |
| penalty_amount | `penalty_amount` | DecimalField |  | default: "Decimal('0')" |
| net_refund | `net_refund` | DecimalField |  | default: "Decimal('0')" |
| reason | `reason` | TextField |  | default: '' |
| refund_date | `refund_date` | DateField |  |  |
| status | `status` | CharField(20) |  | choices: pending, processed, denied; default: 'pending' |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |

## service_sales.Service

Table: `service_sales_service`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| service_type | `service_type` | CharField(20) |  | choices: flight, hotel, tour, insurance, consulting, subscription, training, other |
| category | `category_id` | ForeignKey | yes | FK -> service_sales.ServiceCategory |
| provider | `provider_id` | ForeignKey | yes | FK -> service_sales.ServiceProvider |
| description | `description` | TextField |  | default: '' |
| duration_days | `duration_days` | IntegerField |  | default: 1 |
| selling_price | `selling_price` | DecimalField |  | default: "Decimal('0')" |
| supplier_cost | `supplier_cost` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| tax_percent | `tax_percent` | DecimalField |  | default: "Decimal('9')" |
| is_active | `is_active` | BooleanField |  | default: True |

## service_sales.ServiceCategory

Table: `service_sales_servicecategory`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| description | `description` | TextField |  | default: '' |
| icon | `icon` | CharField(50) |  | default: '' |
| is_active | `is_active` | BooleanField |  | default: True |

## service_sales.ServiceProvider

Table: `service_sales_serviceprovider`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| provider_type | `provider_type` | CharField(30) |  | choices: airline, hotel, tour_operator, insurance, consulting, other |
| contact_info | `contact_info` | TextField |  | default: '' |
| is_active | `is_active` | BooleanField |  | default: True |

## service_sales.Ticket

Table: `service_sales_ticket`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| booking | `booking_id` | ForeignKey |  | FK -> service_sales.Booking |
| passenger | `passenger_id` | ForeignKey |  | FK -> service_sales.Passenger |
| ticket_number | `ticket_number` | CharField(50) |  | default: '' |
| pnr | `pnr` | CharField(10) |  | default: '' |
| airline | `airline` | CharField(100) |  | default: '' |
| flight_number | `flight_number` | CharField(20) |  | default: '' |
| route | `route` | CharField(200) |  | default: '' |
| departure_date | `departure_date` | DateField | yes |  |
| departure_time | `departure_time` | TimeField | yes |  |
| arrival_date | `arrival_date` | DateField | yes |  |
| arrival_time | `arrival_time` | TimeField | yes |  |
| fare | `fare` | DecimalField |  | default: "Decimal('0')" |
| taxes | `taxes` | DecimalField |  | default: "Decimal('0')" |
| total_price | `total_price` | DecimalField |  | default: "Decimal('0')" |
| status | `status` | CharField(20) |  | choices: reserved, issued, cancelled; default: 'reserved' |

## service_sales.TourPackage

Table: `service_sales_tourpackage`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| destination | `destination` | CharField(200) |  | default: '' |
| duration_days | `duration_days` | IntegerField |  | default: 1 |
| description | `description` | TextField |  | default: '' |
| includes_hotel | `includes_hotel` | BooleanField |  | default: False |
| includes_flight | `includes_flight` | BooleanField |  | default: False |
| includes_transfer | `includes_transfer` | BooleanField |  | default: False |
| includes_guide | `includes_guide` | BooleanField |  | default: False |
| includes_meals | `includes_meals` | BooleanField |  | default: False |
| selling_price | `selling_price` | DecimalField |  | default: "Decimal('0')" |
| supplier_cost | `supplier_cost` | DecimalField |  | default: "Decimal('0')" |
| currency | `currency` | CharField(10) |  | default: 'IRR' |
| max_participants | `max_participants` | IntegerField |  | default: 20 |
| is_active | `is_active` | BooleanField |  | default: True |

## sso.SSOLoginAttempt

Table: `sso_ssologinattempt`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| provider | `provider_id` | ForeignKey | yes | FK -> sso.SSOProvider |
| status | `status` | CharField(20) |  | choices: success, failed, error |
| external_email | `external_email` | CharField(254) |  | default: '' |
| external_id | `external_id` | CharField(500) |  | default: '' |
| user | `user_id` | ForeignKey | yes | FK -> accounts.User |
| ip_address | `ip_address` | GenericIPAddressField(39) | yes |  |
| user_agent | `user_agent` | TextField |  | default: '' |
| error_message | `error_message` | TextField |  | default: '' |
| metadata | `metadata` | JSONField |  | default: {} |

## sso.SSOProvider

Table: `sso_ssoprovider`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| slug | `slug` | SlugField(100) |  | unique |
| protocol | `protocol` | CharField(10) |  | choices: saml, oidc; default: 'oidc' |
| status | `status` | CharField(20) |  | choices: active, inactive, pending; default: 'pending' |
| description | `description` | TextField |  | default: '' |
| saml_entity_id | `saml_entity_id` | CharField(500) |  | default: '' |
| saml_sso_url | `saml_sso_url` | CharField(500) |  | default: '' |
| saml_slo_url | `saml_slo_url` | CharField(500) |  | default: '' |
| saml_certificate | `saml_certificate` | BinaryField |  | default: '' |
| saml_metadata_url | `saml_metadata_url` | CharField(500) |  | default: '' |
| saml_name_id_format | `saml_name_id_format` | CharField(200) |  | default: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' |
| oidc_client_id | `oidc_client_id` | CharField(500) |  | default: '' |
| oidc_client_secret | `oidc_client_secret` | BinaryField(500) |  | default: '' |
| oidc_discovery_url | `oidc_discovery_url` | CharField(500) |  | default: '' |
| oidc_authorization_url | `oidc_authorization_url` | CharField(500) |  | default: '' |
| oidc_token_url | `oidc_token_url` | CharField(500) |  | default: '' |
| oidc_userinfo_url | `oidc_userinfo_url` | CharField(500) |  | default: '' |
| oidc_jwks_url | `oidc_jwks_url` | CharField(500) |  | default: '' |
| oidc_scopes | `oidc_scopes` | JSONField |  | default: [] |
| jit_provisioning | `jit_provisioning` | BooleanField |  | default: True |
| default_role | `default_role` | CharField(50) |  | default: 'updater' |
| default_modules | `default_modules` | JSONField |  | default: [] |
| attribute_mapping | `attribute_mapping` | JSONField |  | default: {} |
| allowed_domains | `allowed_domains` | JSONField |  | default: [] |
| logo_url | `logo_url` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |

## sso.SSORefreshToken

Table: `sso_ssorefreshtoken`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| provider | `provider_id` | ForeignKey |  | FK -> sso.SSOProvider |
| user | `user_id` | ForeignKey |  | FK -> accounts.User |
| token_hash | `token_hash` | CharField(256) |  |  |
| external_refresh_token | `external_refresh_token` | TextField |  | default: '' |
| expires_at | `expires_at` | DateTimeField |  |  |
| revoked | `revoked` | BooleanField |  | default: False |
| replaced_by | `replaced_by_id` | ForeignKey | yes | FK -> sso.SSORefreshToken |

## sso.SSOUserMapping

Table: `sso_ssousermapping`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| provider | `provider_id` | ForeignKey |  | FK -> sso.SSOProvider |
| external_id | `external_id` | CharField(500) |  |  |
| external_email | `external_email` | CharField(254) |  | default: '' |
| user | `user_id` | ForeignKey |  | FK -> accounts.User |
| last_login_at | `last_login_at` | DateTimeField | yes |  |
| raw_claims | `raw_claims` | JSONField |  | default: {} |

## trading.Container

Table: `trading_container`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| container_number | `container_number` | CharField(20) |  | unique |
| container_type | `container_type` | CharField(10) |  | choices: 20ft, 40ft, 40ft_hq, 45ft, reefer; default: '40ft' |
| status | `status` | CharField(20) |  | choices: empty, loaded, in_transit, at_port, customs, delivered, returned; default: 'empty' |
| import_order | `import_order_id` | ForeignKey | yes | FK -> trading.ImportOrder |
| export_order | `export_order_id` | ForeignKey | yes | FK -> trading.ExportOrder |
| carrier | `carrier` | CharField(200) |  | default: '' |
| vessel_name | `vessel_name` | CharField(200) |  | default: '' |
| voyage_number | `voyage_number` | CharField(50) |  | default: '' |
| seal_number | `seal_number` | CharField(50) |  | default: '' |
| current_location | `current_location` | CharField(200) |  | default: '' |

## trading.CustomsDocument

Table: `trading_customsdocument`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| import_order | `import_order_id` | ForeignKey |  | FK -> trading.ImportOrder |
| document_type | `document_type` | CharField(25) |  | choices: proforma_invoice, commercial_invoice, packing_list, bill_of_lading, certificate_of_origin, insurance_cert, customs_declaration, phyto_cert, other |
| document_number | `document_number` | CharField(50) |  | default: '' |
| status | `status` | CharField(20) |  | choices: pending, submitted, approved, rejected; default: 'pending' |
| issued_date | `issued_date` | DateField | yes |  |
| expiry_date | `expiry_date` | DateField | yes |  |
| notes | `notes` | TextField |  | default: '' |

## trading.ExportOrder

Table: `trading_exportorder`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| order_number | `order_number` | CharField(50) |  |  |
| customer | `customer_id` | ForeignKey |  | FK -> finance.Customer |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| quantity | `quantity` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_price_foreign | `unit_price_foreign` | DecimalField |  | default: "Decimal('0')" |
| total_price_foreign | `total_price_foreign` | DecimalField |  | default: "Decimal('0')" |
| foreign_currency | `foreign_currency` | CharField(10) |  | default: 'USD' |
| exchange_rate | `exchange_rate` | DecimalField |  | default: "Decimal('1')" |
| total_price_irr | `total_price_irr` | DecimalField |  | default: "Decimal('0')" |
| incoterm | `incoterm` | CharField(5) |  | choices: EXW, FCA, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP; default: 'FOB' |
| port_of_loading | `port_of_loading` | CharField(200) |  | default: '' |
| port_of_discharge | `port_of_discharge` | CharField(200) |  | default: '' |
| status | `status` | CharField(20) |  | choices: draft, confirmed, documentation, shipped, invoiced, completed, cancelled; default: 'draft' |
| estimated_ship_date | `estimated_ship_date` | DateField | yes |  |
| actual_ship_date | `actual_ship_date` | DateField | yes |  |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| description | `description` | TextField |  | default: '' |

## trading.ImportOrder

Table: `trading_importorder`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| order_number | `order_number` | CharField(50) |  |  |
| supplier | `supplier_id` | ForeignKey |  | FK -> finance.Supplier |
| product_name | `product_name` | CharField(200) |  |  |
| product_code | `product_code` | CharField(50) |  | default: '' |
| quantity | `quantity` | DecimalField |  |  |
| unit | `unit` | CharField(20) |  | default: 'عدد' |
| unit_price_foreign | `unit_price_foreign` | DecimalField |  | default: "Decimal('0')" |
| total_price_foreign | `total_price_foreign` | DecimalField |  | default: "Decimal('0')" |
| foreign_currency | `foreign_currency` | CharField(10) |  | default: 'USD' |
| exchange_rate | `exchange_rate` | DecimalField |  | default: "Decimal('1')" |
| total_price_irr | `total_price_irr` | DecimalField |  | default: "Decimal('0')" |
| incoterm | `incoterm` | CharField(5) |  | choices: EXW, FCA, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP; default: 'FOB' |
| port_of_loading | `port_of_loading` | CharField(200) |  | default: '' |
| port_of_discharge | `port_of_discharge` | CharField(200) |  | default: '' |
| customs_declaration_number | `customs_declaration_number` | CharField(50) |  | default: '' |
| customs_duty_amount | `customs_duty_amount` | DecimalField |  | default: "Decimal('0')" |
| customs_vat_amount | `customs_vat_amount` | DecimalField |  | default: "Decimal('0')" |
| status | `status` | CharField(20) |  | choices: draft, confirmed, shipped, customs_pending, customs_cleared, warehouse_received, completed, cancelled; default: 'draft' |
| estimated_delivery | `estimated_delivery` | DateField | yes |  |
| actual_delivery | `actual_delivery` | DateField | yes |  |
| journal_voucher | `journal_voucher_id` | ForeignKey | yes | FK -> finance.JournalVoucher |
| description | `description` | TextField |  | default: '' |

## trading.InternationalCost

Table: `trading_internationalcost`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| import_order | `import_order_id` | ForeignKey | yes | FK -> trading.ImportOrder |
| export_order | `export_order_id` | ForeignKey | yes | FK -> trading.ExportOrder |
| cost_type | `cost_type` | CharField(20) |  | choices: freight, insurance, customs_duty, customs_vat, port_charges, handling, inspection, documentation, bank_charges, other |
| description | `description` | CharField(200) |  | default: '' |
| amount_foreign | `amount_foreign` | DecimalField |  | default: "Decimal('0')" |
| foreign_currency | `foreign_currency` | CharField(10) |  | default: 'USD' |
| exchange_rate | `exchange_rate` | DecimalField |  | default: "Decimal('1')" |
| amount_irr | `amount_irr` | DecimalField |  | default: "Decimal('0')" |

## trading.Shipment

Table: `trading_shipment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| is_deleted | `is_deleted` | BooleanField |  | default: False |
| deleted_at | `deleted_at` | DateTimeField | yes |  |
| deleted_by | `deleted_by_id` | ForeignKey | yes | FK -> accounts.User |
| delete_reason | `delete_reason` | CharField(500) |  | default: '' |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| updated_by | `updated_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| shipment_number | `shipment_number` | CharField(50) |  |  |
| shipment_type | `shipment_type` | CharField(10) |  | choices: sea, air, land, rail, multimodal; default: 'sea' |
| status | `status` | CharField(20) |  | choices: preparing, picked_up, in_transit, at_port, delivered, cancelled; default: 'preparing' |
| import_order | `import_order_id` | ForeignKey | yes | FK -> trading.ImportOrder |
| export_order | `export_order_id` | ForeignKey | yes | FK -> trading.ExportOrder |
| container | `container_id` | ForeignKey | yes | FK -> trading.Container |
| origin | `origin` | CharField(200) |  | default: '' |
| destination | `destination` | CharField(200) |  | default: '' |
| carrier | `carrier` | CharField(200) |  | default: '' |
| estimated_departure | `estimated_departure` | DateField | yes |  |
| actual_departure | `actual_departure` | DateField | yes |  |
| estimated_arrival | `estimated_arrival` | DateField | yes |  |
| actual_arrival | `actual_arrival` | DateField | yes |  |
| freight_cost | `freight_cost` | DecimalField |  | default: "Decimal('0')" |
| insurance_cost | `insurance_cost` | DecimalField |  | default: "Decimal('0')" |
| other_costs | `other_costs` | DecimalField |  | default: "Decimal('0')" |
| total_cost | `total_cost` | DecimalField |  | default: "Decimal('0')" |
| cost_currency | `cost_currency` | CharField(10) |  | default: 'USD' |
| description | `description` | TextField |  | default: '' |

## workflow.WorkflowComment

Table: `workflow_workflowcomment`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| instance | `instance_id` | ForeignKey |  | FK -> workflow.WorkflowInstance |
| author | `author_id` | ForeignKey | yes | FK -> accounts.User |
| text | `text` | TextField |  |  |
| created_at | `created_at` | DateTimeField |  |  |

## workflow.WorkflowDefinition

Table: `workflow_workflowdefinition`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| name | `name` | CharField(200) |  |  |
| document_type | `document_type` | CharField(50) |  |  |
| description | `description` | TextField |  | default: '' |
| version | `version` | IntegerField |  | default: 1 |
| is_active | `is_active` | BooleanField |  | default: True |
| created_by | `created_by_id` | ForeignKey | yes | FK -> accounts.User |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## workflow.WorkflowDelegation

Table: `workflow_workflowdelegation`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| definition | `definition_id` | ForeignKey |  | FK -> workflow.WorkflowDefinition |
| delegator | `delegator_id` | ForeignKey |  | FK -> accounts.User |
| delegate | `delegate_id` | ForeignKey |  | FK -> accounts.User |
| delegation_type | `delegation_type` | CharField(20) |  | choices: temporary, permanent, date_based, emergency; default: 'temporary' |
| reason | `reason` | CharField(500) |  | default: '' |
| start_date | `start_date` | DateField |  | default: 'datetime.date(2026, 11, 21)' |
| end_date | `end_date` | DateField | yes |  |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |
| revoked_at | `revoked_at` | DateTimeField | yes |  |

## workflow.WorkflowEscalationLog

Table: `workflow_workflowescalationlog`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| instance | `instance_id` | ForeignKey |  | FK -> workflow.WorkflowInstance |
| rule | `rule_id` | ForeignKey | yes | FK -> workflow.WorkflowEscalationRule |
| escalated_from | `escalated_from_id` | ForeignKey | yes | FK -> accounts.User |
| escalated_to | `escalated_to_id` | ForeignKey | yes | FK -> accounts.User |
| reason | `reason` | CharField(500) |  | default: '' |
| timestamp | `timestamp` | DateTimeField |  |  |

## workflow.WorkflowEscalationRule

Table: `workflow_workflowescalationrule`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| definition | `definition_id` | ForeignKey |  | FK -> workflow.WorkflowDefinition |
| state | `state_id` | ForeignKey | yes | FK -> workflow.WorkflowState |
| name | `name` | CharField(200) |  |  |
| trigger_type | `trigger_type` | CharField(20) |  | choices: timeout_hours, timeout_days, sla_breach, manual; default: 'timeout_hours' |
| timeout_value | `timeout_value` | IntegerField |  | default: 8 |
| escalation_target | `escalation_target` | CharField(20) |  | choices: next_level, specific_user, department_head, ceo; default: 'next_level' |
| target_user | `target_user_id` | ForeignKey | yes | FK -> accounts.User |
| notify_delegator | `notify_delegator` | BooleanField |  | default: True |
| escalate_only_once | `escalate_only_once` | BooleanField |  | default: True |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## workflow.WorkflowHistory

Table: `workflow_workflowhistory`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| instance | `instance_id` | ForeignKey |  | FK -> workflow.WorkflowInstance |
| previous_state | `previous_state_id` | ForeignKey | yes | FK -> workflow.WorkflowState |
| new_state | `new_state_id` | ForeignKey | yes | FK -> workflow.WorkflowState |
| action | `action` | CharField(50) |  |  |
| performed_by | `performed_by_id` | ForeignKey | yes | FK -> accounts.User |
| comment | `comment` | TextField |  | default: '' |
| timestamp | `timestamp` | DateTimeField |  |  |

## workflow.WorkflowInstance

Table: `workflow_workflowinstance`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| definition | `definition_id` | ForeignKey |  | FK -> workflow.WorkflowDefinition |
| current_state | `current_state_id` | ForeignKey |  | FK -> workflow.WorkflowState |
| document_type | `document_type` | CharField(50) |  |  |
| document_id | `document_id` | BigIntegerField |  |  |
| status | `status` | CharField(20) |  | choices: active, completed, cancelled, rejected; default: 'active' |
| assigned_to | `assigned_to_id` | ForeignKey | yes | FK -> accounts.User |
| assigned_role | `assigned_role` | CharField(50) |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |
| updated_at | `updated_at` | DateTimeField |  |  |

## workflow.WorkflowNotification

Table: `workflow_workflownotification`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| recipient | `recipient_id` | ForeignKey |  | FK -> accounts.User |
| notification_type | `notification_type` | CharField(30) |  | choices: submitted, approval_required, approved, rejected, returned, delegated, escalated, cancelled, completed, sla_warning, sla_breach |
| channel | `channel` | CharField(20) |  | choices: in_app, email, sms, push, webhook; default: 'in_app' |
| title | `title` | CharField(200) |  |  |
| message | `message` | TextField |  |  |
| instance | `instance_id` | ForeignKey | yes | FK -> workflow.WorkflowInstance |
| is_read | `is_read` | BooleanField |  | default: False |
| read_at | `read_at` | DateTimeField | yes |  |
| is_delivered | `is_delivered` | BooleanField |  | default: False |
| delivered_at | `delivered_at` | DateTimeField | yes |  |
| delivery_error | `delivery_error` | CharField(500) |  | default: '' |
| created_at | `created_at` | DateTimeField |  |  |

## workflow.WorkflowNotificationRule

Table: `workflow_workflownotificationrule`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| definition | `definition_id` | ForeignKey |  | FK -> workflow.WorkflowDefinition |
| notification_type | `notification_type` | CharField(30) |  | choices: submitted, approval_required, approved, rejected, returned, delegated, escalated, cancelled, completed, sla_warning, sla_breach |
| target_role | `target_role` | CharField(50) |  |  |
| channel | `channel` | CharField(20) |  | choices: in_app, email, sms, push, webhook; default: 'in_app' |
| is_active | `is_active` | BooleanField |  | default: True |

## workflow.WorkflowRule

Table: `workflow_workflowrule`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| definition | `definition_id` | ForeignKey |  | FK -> workflow.WorkflowDefinition |
| transition | `transition_id` | ForeignKey | yes | FK -> workflow.WorkflowTransition |
| name | `name` | CharField(200) |  |  |
| rule_type | `rule_type` | CharField(30) |  | choices: amount_threshold, role_check, field_value, custom |
| condition | `condition` | JSONField |  | default: {} |
| priority | `priority` | IntegerField |  | default: 0 |
| is_active | `is_active` | BooleanField |  | default: True |

## workflow.WorkflowSLARule

Table: `workflow_workflowslarule`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| company | `company_id` | ForeignKey |  | FK -> accounts.Company |
| definition | `definition_id` | ForeignKey |  | FK -> workflow.WorkflowDefinition |
| state | `state_id` | ForeignKey |  | FK -> workflow.WorkflowState |
| name | `name` | CharField(200) |  |  |
| max_hours | `max_hours` | DecimalField |  |  |
| warning_hours | `warning_hours` | DecimalField | yes |  |
| notify_on_warning | `notify_on_warning` | BooleanField |  | default: True |
| notify_on_breach | `notify_on_breach` | BooleanField |  | default: True |
| escalate_on_breach | `escalate_on_breach` | BooleanField |  | default: False |
| auto_cancel_on_breach | `auto_cancel_on_breach` | BooleanField |  | default: False |
| is_active | `is_active` | BooleanField |  | default: True |
| created_at | `created_at` | DateTimeField |  |  |

## workflow.WorkflowSLATracker

Table: `workflow_workflowslatracker`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| instance | `instance_id` | ForeignKey |  | FK -> workflow.WorkflowInstance |
| sla_rule | `sla_rule_id` | ForeignKey |  | FK -> workflow.WorkflowSLARule |
| state | `state_id` | ForeignKey |  | FK -> workflow.WorkflowState |
| started_at | `started_at` | DateTimeField |  | default: 'datetime.datetime(2026, 11, 21, 8, 32, 5, 319567, tzinfo=datetime.timezone.utc)' |
| deadline | `deadline` | DateTimeField |  |  |
| warning_at | `warning_at` | DateTimeField | yes |  |
| completed_at | `completed_at` | DateTimeField | yes |  |
| status | `status` | CharField(20) |  | choices: on_track, warning, breached, completed; default: 'on_track' |
| breach_notified | `breach_notified` | BooleanField |  | default: False |
| warning_notified | `warning_notified` | BooleanField |  | default: False |

## workflow.WorkflowState

Table: `workflow_workflowstate`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| definition | `definition_id` | ForeignKey |  | FK -> workflow.WorkflowDefinition |
| name | `name` | CharField(100) |  |  |
| state_type | `state_type` | CharField(20) |  | choices: start, normal, approval, review, waiting, automated, completed, cancelled, rejected; default: 'normal' |
| required_role | `required_role` | CharField(50) |  | default: '' |
| description | `description` | TextField |  | default: '' |
| order | `order` | IntegerField |  | default: 0 |

## workflow.WorkflowTransition

Table: `workflow_workflowtransition`

| Field | Column | Type | Null | Notes |
|---|---|---|---|---|
| id | `id` | BigAutoField |  | unique |
| definition | `definition_id` | ForeignKey |  | FK -> workflow.WorkflowDefinition |
| source_state | `source_state_id` | ForeignKey |  | FK -> workflow.WorkflowState |
| target_state | `target_state_id` | ForeignKey |  | FK -> workflow.WorkflowState |
| action | `action` | CharField(50) |  |  |
| description | `description` | TextField |  | default: '' |
| requires_comment | `requires_comment` | BooleanField |  | default: False |
| auto_execute | `auto_execute` | BooleanField |  | default: False |
