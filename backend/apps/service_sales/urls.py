"""
Service Sales Module URLs — API routes for service sales endpoints.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"categories", views.ServiceCategoryViewSet, basename="service-category")
router.register(r"providers", views.ServiceProviderViewSet, basename="service-provider")
router.register(r"services", views.ServiceViewSet, basename="service")
router.register(r"bookings", views.BookingViewSet, basename="booking")
router.register(r"passengers", views.PassengerViewSet, basename="passenger")
router.register(r"tickets", views.TicketViewSet, basename="ticket")
router.register(r"tour-packages", views.TourPackageViewSet, basename="tour-package")
router.register(r"hotel-reservations", views.HotelReservationViewSet, basename="hotel-reservation")
router.register(r"commission-rules", views.CommissionRuleViewSet, basename="commission-rule")
router.register(r"commissions", views.CommissionTransactionViewSet, basename="commission")
router.register(r"refunds", views.RefundTransactionViewSet, basename="refund")

urlpatterns = [
    path("", include(router.urls)),
]
