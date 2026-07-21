"""
Inventory Module Views — REST API.

Per API_SPECIFICATION.md §25: Inventory API.
Per DJANGO_BACKEND.md §35: API Architecture.
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from decimal import Decimal
from django.db.models import Sum, F

from apps.core.responses import (
    success_response, error_response, business_rule_error,
    not_found_response, paginated_response,
)
from .models import (
    Warehouse, Location, StockLedger, StockMovement,
    InventoryReservation, CycleCount, CycleCountLine, StockAdjustment,
)
from .serializers import (
    WarehouseSerializer, LocationSerializer, StockLedgerSerializer,
    StockMovementSerializer, InventoryReservationSerializer,
    CycleCountSerializer, CycleCountLineSerializer, StockAdjustmentSerializer,
)
from .services import InventoryService, StockMovementService, ReservationService, ValuationEngine



# ─── Warehouse ──────────────────────────────────────────────────

@api_view(["GET", "POST"])
def warehouse_list(request):
    """List or create warehouses."""
    if request.method == "GET":
        warehouses = Warehouse.objects.filter(
            company=request.user.company, is_active=True
        )
        serializer = WarehouseSerializer(warehouses, many=True)
        return success_response(data=serializer.data)

    serializer = WarehouseSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(company=request.user.company, created_by=request.user)
        return success_response(data=serializer.data, http_status_code=201)
    return error_response(message="Validation error", errors=serializer.errors)


@api_view(["GET", "PUT", "DELETE"])
def warehouse_detail(request, pk):
    """Retrieve, update, or delete a warehouse."""
    try:
        warehouse = Warehouse.objects.get(pk=pk, company=request.user.company)
    except Warehouse.DoesNotExist:
        return not_found_response("Warehouse not found")

    if request.method == "GET":
        serializer = WarehouseSerializer(warehouse)
        return success_response(data=serializer.data)

    if request.method == "PUT":
        serializer = WarehouseSerializer(warehouse, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return success_response(data=serializer.data)
        return error_response(message="Validation error", errors=serializer.errors)

    # DELETE = soft delete
    warehouse.soft_delete(user=request.user)
    return success_response(message="Warehouse deleted")


# ─── Stock Balances ─────────────────────────────────────────────

@api_view(["GET"])
def stock_balance_list(request):
    """List all stock balances for the company."""
    product_code = request.query_params.get("product_code")
    warehouse_id = request.query_params.get("warehouse_id")

    if product_code:
        data = InventoryService.get_stock_balance(
            request.user.company, product_code,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
        )
        return success_response(data=data)

    if warehouse_id:
        data = InventoryService.get_warehouse_stock(
            request.user.company, int(warehouse_id)
        )
        return success_response(data=data)

    # All balances
    ledgers = StockLedger.objects.filter(
        company=request.user.company
    ).select_related("warehouse").order_by("product_code")

    serializer = StockLedgerSerializer(ledgers, many=True)
    return success_response(data=serializer.data)


@api_view(["GET"])
def stock_check_availability(request):
    """Check stock availability for a product."""
    product_code = request.query_params.get("product_code")
    warehouse_id = request.query_params.get("warehouse_id")
    quantity = request.query_params.get("quantity", "0")

    if not product_code or not warehouse_id:
        return error_response("product_code and warehouse_id are required")

    result = InventoryService.check_availability(
        request.user.company,
        product_code,
        int(warehouse_id),
        Decimal(quantity),
    )
    return success_response(data=result)


@api_view(["GET"])
def low_stock_list(request):
    """Get all items below reorder level."""
    warehouse_id = request.query_params.get("warehouse_id")
    data = InventoryService.get_low_stock_items(
        request.user.company,
        warehouse_id=int(warehouse_id) if warehouse_id else None,
    )
    return success_response(data=data)


# ─── Stock Movements ────────────────────────────────────────────

@api_view(["GET", "POST"])
def stock_movement_list(request):
    """List or create stock movements."""
    if request.method == "GET":
        movements = StockMovement.objects.filter(
            company=request.user.company
        ).select_related("warehouse", "performed_by").order_by("-movement_date")[:100]
        serializer = StockMovementSerializer(movements, many=True)
        return success_response(data=serializer.data)

    # Create receipt
    movement_type = request.data.get("movement_type", "receipt")

    try:
        if movement_type == "receipt":
            movement = StockMovementService.create_receipt(
                company=request.user.company,
                warehouse_id=int(request.data["warehouse"]),
                product_name=request.data["product_name"],
                product_code=request.data.get("product_code", ""),
                quantity=Decimal(str(request.data["quantity"])),
                unit_cost=Decimal(str(request.data.get("unit_cost", "0"))),
                unit=request.data.get("unit", "عدد"),
                reference_type=request.data.get("reference_type", ""),
                reference_id=request.data.get("reference_id"),
                user=request.user,
                description=request.data.get("description", ""),
                batch_number=request.data.get("batch_number", ""),
                serial_number=request.data.get("serial_number", ""),
                location_id=request.data.get("location"),
            )
        elif movement_type == "issue":
            movement = StockMovementService.create_issue(
                company=request.user.company,
                warehouse_id=int(request.data["warehouse"]),
                product_name=request.data["product_name"],
                product_code=request.data.get("product_code", ""),
                quantity=Decimal(str(request.data["quantity"])),
                unit_cost=Decimal(str(request.data.get("unit_cost", "0"))),
                unit=request.data.get("unit", "عدد"),
                reference_type=request.data.get("reference_type", ""),
                reference_id=request.data.get("reference_id"),
                user=request.user,
                description=request.data.get("description", ""),
                location_id=request.data.get("location"),
            )
        elif movement_type == "transfer":
            result = StockMovementService.create_transfer(
                company=request.user.company,
                from_warehouse_id=int(request.data["warehouse"]),
                to_warehouse_id=int(request.data["to_warehouse"]),
                product_name=request.data["product_name"],
                product_code=request.data.get("product_code", ""),
                quantity=Decimal(str(request.data["quantity"])),
                unit_cost=Decimal(str(request.data.get("unit_cost", "0"))),
                unit=request.data.get("unit", "عدد"),
                user=request.user,
                description=request.data.get("description", ""),
            )
            return success_response(
                data={
                    "issue": StockMovementSerializer(result["issue_movement"]).data,
                    "receipt": StockMovementSerializer(result["receipt_movement"]).data,
                },
                http_status_code=201,
            )
        else:
            return error_response(f"Unknown movement type: {movement_type}")

        serializer = StockMovementSerializer(movement)
        return success_response(data=serializer.data, http_status_code=201)

    except Exception as e:
        return business_rule_error(str(e))


# ─── Reservations ───────────────────────────────────────────────

@api_view(["GET", "POST"])
def reservation_list(request):
    """List or create inventory reservations."""
    if request.method == "GET":
        reservations = InventoryReservation.objects.filter(
            company=request.user.company
        ).select_related("warehouse", "reserved_by").order_by("-created_at")[:100]
        serializer = InventoryReservationSerializer(reservations, many=True)
        return success_response(data=serializer.data)

    try:
        reservation = ReservationService.reserve_stock(
            company=request.user.company,
            product_name=request.data["product_name"],
            product_code=request.data.get("product_code", ""),
            warehouse_id=int(request.data["warehouse"]),
            quantity=Decimal(str(request.data["quantity"])),
            reference_type=request.data["reference_type"],
            reference_id=int(request.data["reference_id"]),
            user=request.user,
            unit=request.data.get("unit", "عدد"),
        )
        serializer = InventoryReservationSerializer(reservation)
        return success_response(data=serializer.data, http_status_code=201)
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def reservation_release(request, pk):
    """Release a reservation."""
    try:
        reservation = ReservationService.release_reservation(
            company=request.user.company,
            reservation_id=pk,
            user=request.user,
        )
        serializer = InventoryReservationSerializer(reservation)
        return success_response(data=serializer.data, message="Reservation released")
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def reservation_fulfill(request, pk):
    """Fulfill a reservation by issuing stock."""
    quantity = Decimal(str(request.data.get("quantity", "0")))
    if quantity <= 0:
        return error_response("Quantity must be positive")

    try:
        reservation = ReservationService.fulfill_reservation(
            company=request.user.company,
            reservation_id=pk,
            quantity=quantity,
        )
        serializer = InventoryReservationSerializer(reservation)
        return success_response(data=serializer.data, message="Reservation fulfilled")
    except Exception as e:
        return business_rule_error(str(e))


# ─── Cycle Count ────────────────────────────────────────────────

@api_view(["GET", "POST"])
def cycle_count_list(request):
    """List or create cycle counts."""
    if request.method == "GET":
        counts = CycleCount.objects.filter(
            company=request.user.company
        ).select_related("warehouse").order_by("-count_date")[:50]
        serializer = CycleCountSerializer(counts, many=True)
        return success_response(data=serializer.data)

    serializer = CycleCountSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(
            company=request.user.company,
            counted_by=request.user,
        )
        return success_response(data=serializer.data, http_status_code=201)
    return error_response(message="Validation error", errors=serializer.errors)


@api_view(["GET"])
def valuation_list(request):
    """Get inventory valuation report."""
    warehouse_id = request.query_params.get("warehouse_id")
    data = ValuationEngine.get_inventory_valuation(
        request.user.company,
        warehouse_id=int(warehouse_id) if warehouse_id else None,
    )
    return success_response(data=data)


# ─── Summary ────────────────────────────────────────────────────

@api_view(["GET"])
def inventory_summary(request):
    """Inventory dashboard summary."""
    company = request.user.company

    total_warehouses = Warehouse.objects.filter(company=company, is_active=True).count()
    total_products = StockLedger.objects.filter(company=company).values("product_code").distinct().count()
    total_value = StockLedger.objects.filter(company=company).aggregate(
        total=Sum("total_value")
    )["total"] or 0

    low_stock = StockLedger.objects.filter(
        company=company,
        reorder_level__gt=0,
        quantity_on_hand__lte=F("reorder_level"),
    ).count()

    pending_reservations = InventoryReservation.objects.filter(
        company=company, status="active"
    ).count()

    return success_response(data={
        "total_warehouses": total_warehouses,
        "total_products": total_products,
        "total_inventory_value": total_value,
        "low_stock_items": low_stock,
        "pending_reservations": pending_reservations,
    })
