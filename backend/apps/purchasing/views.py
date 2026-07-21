"""
Purchasing Module Views — REST API.

Per API_SPECIFICATION.md §37-§39: Purchasing API.
Per DJANGO_BACKEND.md §35: API Architecture.
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from decimal import Decimal
from django.db.models import Sum, Count, Q

from apps.core.responses import (
    success_response, error_response, business_rule_error,
    not_found_response,
)

from .models import (
    PurchaseRequest, PurchaseOrder, GoodsReceipt, PurchaseReturn,
)
from .serializers import (
    PurchaseRequestSerializer, PurchaseOrderSerializer,
    GoodsReceiptSerializer, PurchaseReturnSerializer,
)
from .services import PurchasingService, GoodsReceiptService


# ─── Purchase Requests ──────────────────────────────────────────

@api_view(["GET", "POST"])
def purchase_request_list(request):
    """List or create purchase requests."""
    if request.method == "GET":
        requests = PurchaseRequest.objects.filter(
            company=request.user.company
        ).select_related("requested_by").order_by("-created_at")[:100]
        serializer = PurchaseRequestSerializer(requests, many=True)
        return success_response(data=serializer.data)

    serializer = PurchaseRequestSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(
            company=request.user.company,
            requested_by=request.user,
        )
        return success_response(data=serializer.data, http_status_code=201)
    return error_response(message="Validation error", errors=serializer.errors)


@api_view(["GET", "PUT"])
def purchase_request_detail(request, pk):
    """Retrieve or update a purchase request."""
    try:
        pr = PurchaseRequest.objects.get(pk=pk, company=request.user.company)
    except PurchaseRequest.DoesNotExist:
        return not_found_response("Purchase request not found")

    if request.method == "GET":
        serializer = PurchaseRequestSerializer(pr)
        return success_response(data=serializer.data)

    serializer = PurchaseRequestSerializer(pr, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=request.user)
        return success_response(data=serializer.data)
    return error_response(message="Validation error", errors=serializer.errors)


@api_view(["POST"])
def purchase_request_approve(request, pk):
    """Approve a purchase request."""
    try:
        pr = PurchaseRequest.objects.get(pk=pk, company=request.user.company)
    except PurchaseRequest.DoesNotExist:
        return not_found_response("Purchase request not found")

    try:
        pr = PurchasingService.approve_purchase_request(pr, request.user)
        serializer = PurchaseRequestSerializer(pr)
        return success_response(data=serializer.data, message="Purchase request approved")
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def purchase_request_reject(request, pk):
    """Reject a purchase request."""
    try:
        pr = PurchaseRequest.objects.get(pk=pk, company=request.user.company)
    except PurchaseRequest.DoesNotExist:
        return not_found_response("Purchase request not found")

    reason = request.data.get("reason", "")
    try:
        pr = PurchasingService.reject_purchase_request(pr, request.user, reason)
        serializer = PurchaseRequestSerializer(pr)
        return success_response(data=serializer.data, message="Purchase request rejected")
    except Exception as e:
        return business_rule_error(str(e))


# ─── Purchase Orders ────────────────────────────────────────────

@api_view(["GET", "POST"])
def purchase_order_list(request):
    """List or create purchase orders."""
    if request.method == "GET":
        orders = PurchaseOrder.objects.filter(
            company=request.user.company
        ).order_by("-order_date", "-order_number")[:100]
        serializer = PurchaseOrderSerializer(orders, many=True)
        return success_response(data=serializer.data)

    serializer = PurchaseOrderSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(company=request.user.company)
        return success_response(data=serializer.data, http_status_code=201)
    return error_response(message="Validation error", errors=serializer.errors)


@api_view(["GET", "PUT"])
def purchase_order_detail(request, pk):
    """Retrieve or update a purchase order."""
    try:
        po = PurchaseOrder.objects.get(pk=pk, company=request.user.company)
    except PurchaseOrder.DoesNotExist:
        return not_found_response("Purchase order not found")

    if request.method == "GET":
        serializer = PurchaseOrderSerializer(po)
        return success_response(data=serializer.data)

    serializer = PurchaseOrderSerializer(po, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=request.user)
        return success_response(data=serializer.data)
    return error_response(message="Validation error", errors=serializer.errors)


@api_view(["POST"])
def purchase_order_approve(request, pk):
    """Approve a purchase order."""
    try:
        po = PurchaseOrder.objects.get(pk=pk, company=request.user.company)
    except PurchaseOrder.DoesNotExist:
        return not_found_response("Purchase order not found")

    try:
        po = PurchasingService.approve_purchase_order(po, request.user)
        serializer = PurchaseOrderSerializer(po)
        return success_response(data=serializer.data, message="Purchase order approved")
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def purchase_order_close(request, pk):
    """Close a purchase order."""
    try:
        po = PurchaseOrder.objects.get(pk=pk, company=request.user.company)
    except PurchaseOrder.DoesNotExist:
        return not_found_response("Purchase order not found")

    try:
        po = PurchasingService.close_purchase_order(po, request.user)
        serializer = PurchaseOrderSerializer(po)
        return success_response(data=serializer.data, message="Purchase order closed")
    except Exception as e:
        return business_rule_error(str(e))


# ─── Goods Receipts ─────────────────────────────────────────────

@api_view(["GET", "POST"])
def goods_receipt_list(request):
    """List or create goods receipts."""
    if request.method == "GET":
        receipts = GoodsReceipt.objects.filter(
            company=request.user.company
        ).select_related("purchase_order").order_by("-created_at")[:100]
        serializer = GoodsReceiptSerializer(receipts, many=True)
        return success_response(data=serializer.data)

    serializer = GoodsReceiptSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(
            company=request.user.company,
            received_by=request.user,
        )
        return success_response(data=serializer.data, http_status_code=201)
    return error_response(message="Validation error", errors=serializer.errors)


@api_view(["POST"])
def goods_receipt_receive(request, pk):
    """Process goods receipt."""
    try:
        receipt = GoodsReceipt.objects.get(pk=pk, company=request.user.company)
    except GoodsReceipt.DoesNotExist:
        return not_found_response("Goods receipt not found")

    try:
        receipt = GoodsReceiptService.receive_goods(receipt, request.user)
        serializer = GoodsReceiptSerializer(receipt)
        return success_response(data=serializer.data, message="Goods received")
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def goods_receipt_approve(request, pk):
    """Approve goods receipt after inspection."""
    try:
        receipt = GoodsReceipt.objects.get(pk=pk, company=request.user.company)
    except GoodsReceipt.DoesNotExist:
        return not_found_response("Goods receipt not found")

    try:
        receipt = GoodsReceiptService.approve_goods_receipt(receipt, request.user)
        serializer = GoodsReceiptSerializer(receipt)
        return success_response(data=serializer.data, message="Goods receipt approved")
    except Exception as e:
        return business_rule_error(str(e))


# ─── Purchase Returns ───────────────────────────────────────────

@api_view(["GET", "POST"])
def purchase_return_list(request):
    """List or create purchase returns."""
    if request.method == "GET":
        returns = PurchaseReturn.objects.filter(
            company=request.user.company
        ).order_by("-created_at")[:100]
        serializer = PurchaseReturnSerializer(returns, many=True)
        return success_response(data=serializer.data)

    serializer = PurchaseReturnSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(company=request.user.company)
        return success_response(data=serializer.data, http_status_code=201)
    return error_response(message="Validation error", errors=serializer.errors)


# ─── Summary ────────────────────────────────────────────────────

@api_view(["GET"])
def purchasing_summary(request):
    """Purchasing dashboard summary."""
    company = request.user.company

    total_pr = PurchaseRequest.objects.filter(company=company).count()
    pending_pr = PurchaseRequest.objects.filter(company=company, status="submitted").count()
    total_po = PurchaseOrder.objects.filter(company=company).count()
    active_po = PurchaseOrder.objects.filter(
        company=company,
        status__in=("approved", "confirmed", "partially_received"),
    ).count()
    total_receipts = GoodsReceipt.objects.filter(company=company).count()
    pending_receipts = GoodsReceipt.objects.filter(
        company=company, status__in=("draft", "inspected"),
    ).count()

    # Total value
    po_value = PurchaseOrder.objects.filter(
        company=company,
        status__in=("approved", "confirmed", "partially_received"),
    ).aggregate(total=Sum("total"))["total"] or 0

    return success_response(data={
        "total_purchase_requests": total_pr,
        "pending_purchase_requests": pending_pr,
        "total_purchase_orders": total_po,
        "active_purchase_orders": active_po,
        "total_goods_receipts": total_receipts,
        "pending_goods_receipts": pending_receipts,
        "active_order_value": po_value,
    })
