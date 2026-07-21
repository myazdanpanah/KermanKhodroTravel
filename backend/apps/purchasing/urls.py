"""
Purchasing Module URL Patterns.
Per API_SPECIFICATION.md §37-§39: Purchasing API.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Purchase Requests
    path("requests/", views.purchase_request_list, name="purchase-request-list"),
    path("requests/<int:pk>/", views.purchase_request_detail, name="purchase-request-detail"),
    path("requests/<int:pk>/approve/", views.purchase_request_approve, name="purchase-request-approve"),
    path("requests/<int:pk>/reject/", views.purchase_request_reject, name="purchase-request-reject"),

    # Purchase Orders
    path("orders/", views.purchase_order_list, name="purchase-order-list"),
    path("orders/<int:pk>/", views.purchase_order_detail, name="purchase-order-detail"),
    path("orders/<int:pk>/approve/", views.purchase_order_approve, name="purchase-order-approve"),
    path("orders/<int:pk>/close/", views.purchase_order_close, name="purchase-order-close"),

    # Goods Receipts
    path("receipts/", views.goods_receipt_list, name="goods-receipt-list"),
    path("receipts/<int:pk>/receive/", views.goods_receipt_receive, name="goods-receipt-receive"),
    path("receipts/<int:pk>/approve/", views.goods_receipt_approve, name="goods-receipt-approve"),

    # Purchase Returns
    path("returns/", views.purchase_return_list, name="purchase-return-list"),

    # Summary
    path("summary/", views.purchasing_summary, name="purchasing-summary"),
]
