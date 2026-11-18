from django.urls import path

from . import views

app_name = "billing"

urlpatterns = [
    # Payers / companies (spec 6.3)
    path("payers/", views.payer_list_create, name="payer-list"),
    path("payers/<str:code>/balance/", views.payer_balance_view, name="payer-balance"),
    path("payers/<str:code>/", views.payer_detail, name="payer-detail"),
    # Invoices (spec 6.4)
    path("invoices/", views.invoice_list, name="invoice-list"),
    path("invoices/<int:pk>/", views.invoice_detail, name="invoice-detail"),
    # Payments (spec 6.5)
    path("payments/", views.payment_list, name="payment-list"),
    path("payments/<int:pk>/", views.payment_detail, name="payment-detail"),
    # Manual debts (spec 6.6)
    path("debts/", views.debt_list, name="debt-list"),
    path("debts/<int:pk>/", views.debt_detail, name="debt-detail"),
    # Credits (spec 6.7)
    path("credits/", views.credit_list, name="credit-list"),
    path("credits/<int:pk>/", views.credit_detail, name="credit-detail"),
    # Excel (spec 6.8)
    path("upload/excel/", views.excel_upload, name="excel-upload"),
    path("process/excel/", views.excel_process, name="excel-process"),
    # Approvals (spec 6.9)
    path("approvals/", views.approval_list, name="approval-list"),
    path("approvals/pending/", views.approval_pending, name="approval-pending"),
    path("approvals/mine/", views.approval_mine, name="approval-mine"),
    path("approvals/<int:pk>/", views.approval_detail, name="approval-detail"),
    path("approvals/<int:pk>/approve/", views.approval_approve, name="approval-approve"),
    path("approvals/<int:pk>/reject/", views.approval_reject, name="approval-reject"),
    path("approvals/<int:pk>/files/", views.approval_files, name="approval-files"),
    # Files (spec 6.10)
    path("files/<int:pk>/download/", views.file_download, name="file-download"),
    path("files/by-letter/<str:letter_number>/", views.file_by_letter, name="file-by-letter"),
    path("files/<int:pk>/regenerate/", views.file_regenerate, name="file-regenerate"),
    # Templates (spec 6.11)
    path("templates/active/", views.template_active, name="template-active"),
    path("templates/active/preview/", views.template_preview, name="template-preview"),
    # Service categories (spec 6.12)
    path("service-categories/", views.service_category_list, name="service-category-list"),
    path("service-categories/<int:pk>/", views.service_category_detail, name="service-category-detail"),
    # Company settings (spec 6.13)
    path("settings/", views.company_settings_view, name="company-settings"),
    path("settings/upload-asset/", views.company_settings_asset, name="company-settings-asset"),
    path("settings/upload-template/", views.company_settings_word_template, name="company-settings-word-template"),
    # Backup / restore (spec 6.14)
    path("admin/backup/", views.admin_backup, name="admin-backup"),
    path("admin/restore/", views.admin_restore, name="admin-restore"),
    # Misc
    path("me/", views.me_permissions, name="me-permissions"),
    path("next-letter/", views.next_letter, name="next-letter"),
    path("passengers/", views.passenger_suggestions, name="passenger-suggestions"),
    path("invoices/types/", views.invoice_types, name="invoice-types"),
    path("dashboard/summary/", views.dashboard_summary, name="dashboard-summary"),
]
