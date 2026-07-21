"""
Inventory Module URL Patterns.
Per API_SPECIFICATION.md §25: Inventory API.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Warehouses
    path("warehouses/", views.warehouse_list, name="warehouse-list"),
    path("warehouses/<int:pk>/", views.warehouse_detail, name="warehouse-detail"),

    # Stock Balances
    path("balances/", views.stock_balance_list, name="stock-balance-list"),
    path("check-availability/", views.stock_check_availability, name="stock-check-availability"),
    path("low-stock/", views.low_stock_list, name="low-stock-list"),

    # Stock Movements
    path("movements/", views.stock_movement_list, name="stock-movement-list"),

    # Reservations
    path("reservations/", views.reservation_list, name="reservation-list"),
    path("reservations/<int:pk>/release/", views.reservation_release, name="reservation-release"),
    path("reservations/<int:pk>/fulfill/", views.reservation_fulfill, name="reservation-fulfill"),

    # Cycle Count
    path("cycle-counts/", views.cycle_count_list, name="cycle-count-list"),

    # Valuation & Reports
    path("valuation/", views.valuation_list, name="valuation-list"),
    path("summary/", views.inventory_summary, name="inventory-summary"),
]
