"""
Read-only business-data adapter.

Office never writes to finance or CRM. Every panel value is resolved live from
the authoritative tables and filtered by the caller's company; amounts are
omitted for users who may not see financial data.
"""

from django.db.models import Sum
from django.utils import timezone

from apps.crm.models import Opportunity
from apps.finance.models import Customer, Invoice, Payment, Receipt

from .models import BusinessRecordReference, OfficeBusinessLink
from .services import OfficeError

ENTITY_TYPES = ("customer", "invoice", "receipt", "payment", "opportunity")
FULL_ACCESS_ROLES = ("finance", "ceo", "admin")


def can_see_financials(user):
    return bool(user.is_staff or getattr(user, "role", None) in FULL_ACCESS_ROLES)


def _get(company, entity_type, record_id):
    if entity_type == "customer":
        return Customer.objects.filter(company=company, pk=record_id).first()
    if entity_type == "invoice":
        return Invoice.objects.select_related("customer").filter(company=company, pk=record_id).first()
    if entity_type == "receipt":
        return Receipt.objects.select_related("customer", "invoice").filter(company=company, pk=record_id).first()
    if entity_type == "payment":
        return Payment.objects.filter(company=company, pk=record_id).first()
    if entity_type == "opportunity":
        return Opportunity.objects.filter(company=company, pk=record_id).first()
    raise OfficeError("نوع رکورد پشتیبانی نمی‌شود", 400)


def resolve(company, entity_type, record_id, user):
    """Return a safe, fresh DTO for one business record."""
    if entity_type not in ENTITY_TYPES:
        raise OfficeError("نوع رکورد پشتیبانی نمی‌شود", 400)
    try:
        record_id = int(str(record_id))
    except (TypeError, ValueError):
        raise OfficeError("شناسه رکورد نامعتبر است", 400)

    record = _get(company, entity_type, record_id)
    if record is None:
        raise OfficeError("رکورد در سیستم مالی یافت نشد", 404)

    show_money = can_see_financials(user)
    links = {}
    display = {}

    if entity_type == "customer":
        display = {"name": record.name, "code": getattr(record, "national_id", "") or str(record.pk),
                   "is_active": record.is_active}
        if show_money:
            display["balance"] = record.balance
            display["currency"] = "IRR"
        links = {"customer": f"/erp/billing/payers?customer={record.pk}"}

    elif entity_type == "invoice":
        paid = Receipt.objects.filter(company=company, invoice=record).aggregate(total=Sum("amount"))["total"] or 0
        display = {
            "invoice_number": f"INV-{record.fiscal_year_id}-{record.number:05d}",
            "customer_name": record.customer.name if record.customer_id else "",
            "issue_date": record.date_jalali or record.date.isoformat(),
            "status": record.status,
        }
        if show_money:
            display.update({
                "total_amount": record.total,
                "paid_amount": paid,
                "outstanding_amount": max(record.total - paid, 0),
                "currency": "IRR",
            })
        links = {
            "invoice": f"/erp/billing/invoices?invoice={record.pk}",
            "payments": f"/erp/billing/payments?invoice={record.pk}",
        }
        if record.customer_id:
            links["customer"] = f"/erp/billing/payers?customer={record.customer_id}"

    elif entity_type == "receipt":
        display = {
            "receipt_number": f"RCP-{record.number}",
            "customer_name": record.customer.name if record.customer_id else "",
            "date": record.date_jalali or record.date.isoformat(),
            "payment_method": record.payment_method,
            "invoice_number": record.invoice.number if record.invoice_id else None,
        }
        if show_money:
            display.update({"amount": record.amount, "currency": "IRR"})
        links = {"payments": f"/erp/billing/payments?receipt={record.pk}"}

    elif entity_type == "payment":
        display = {
            "payment_number": f"PAY-{record.number}",
            "date": record.date_jalali or record.date.isoformat(),
            "payment_method": record.payment_method,
            "status": record.status,
        }
        if show_money:
            display.update({"amount": record.amount, "currency": "IRR"})
        links = {"payments": f"/erp/billing/payments?payment={record.pk}"}

    else:
        display = {
            "name": record.name,
            "status": record.status,
            "customer_name": record.customer.name if record.customer_id else "",
            "probability": record.probability,
        }
        if show_money:
            display.update({"estimated_value": record.estimated_value, "currency": record.currency})
        links = {"opportunity": f"/erp/crm/opportunities?opportunity={record.pk}"}

    return {
        "source": "nexivo_business",
        "entity_type": entity_type,
        "source_record_id": str(record.pk),
        "display": display,
        "links": links,
        "meta": {"read_at": timezone.now().isoformat(), "is_cached": False},
    }


def search(company, entity_type, query, user, limit=12):
    """Search approved fields only; never arbitrary SQL."""
    query = (query or "").strip()
    if entity_type not in ENTITY_TYPES:
        raise OfficeError("نوع رکورد پشتیبانی نمی‌شود", 400)
    results = []
    if entity_type == "customer":
        qs = Customer.objects.filter(company=company)
        if query:
            qs = qs.filter(name__icontains=query)
        for row in qs.order_by("name")[:limit]:
            results.append({"id": str(row.pk), "label": row.name, "sublabel": row.mobile or row.phone})
    elif entity_type == "invoice":
        qs = Invoice.objects.select_related("customer").filter(company=company)
        if query:
            if query.isdigit():
                qs = qs.filter(number=int(query)) | qs.filter(customer__name__icontains=query)
            else:
                qs = qs.filter(customer__name__icontains=query)
        for row in qs.order_by("-date", "-number")[:limit]:
            results.append({
                "id": str(row.pk),
                "label": f"INV-{row.fiscal_year_id}-{row.number:05d}",
                "sublabel": f"{row.customer.name if row.customer_id else '—'} · {row.date_jalali}",
            })
    elif entity_type == "receipt":
        qs = Receipt.objects.select_related("customer").filter(company=company)
        if query:
            qs = qs.filter(customer__name__icontains=query)
        for row in qs.order_by("-date")[:limit]:
            results.append({"id": str(row.pk), "label": f"RCP-{row.number}",
                            "sublabel": row.customer.name if row.customer_id else ""})
    elif entity_type == "payment":
        qs = Payment.objects.filter(company=company)
        for row in qs.order_by("-date")[:limit]:
            results.append({"id": str(row.pk), "label": f"PAY-{row.number}", "sublabel": row.date_jalali})
    else:
        qs = Opportunity.objects.filter(company=company)
        if query:
            qs = qs.filter(name__icontains=query)
        for row in qs.order_by("-created_at")[:limit]:
            results.append({"id": str(row.pk), "label": row.name, "sublabel": row.status})
    return results


def add_link(company, user, office_object_type, office_object_id, entity_type, source_record_id,
             relationship_type="about", label=""):
    dto = resolve(company, entity_type, source_record_id, user)
    reference, _ = BusinessRecordReference.objects.get_or_create(
        company=company,
        source_system="nexivo_business",
        entity_type=entity_type,
        source_record_id=str(source_record_id),
        defaults={"display_snapshot": dto["display"], "created_by": user},
    )
    link, _ = OfficeBusinessLink.objects.get_or_create(
        company=company,
        office_object_type=office_object_type,
        office_object_id=str(office_object_id),
        reference=reference,
        relationship_type=relationship_type,
        defaults={"label": label, "created_by": user},
    )
    return link


def links_for(company, office_object_type, office_object_id, user):
    """Resolve every link afresh so a stale snapshot is never shown as current."""
    links = OfficeBusinessLink.objects.filter(
        company=company,
        office_object_type=office_object_type,
        office_object_id=str(office_object_id),
    ).select_related("reference")
    out = []
    for link in links:
        item = {
            "id": link.id,
            "relationship_type": link.relationship_type,
            "label": link.label,
            "entity_type": link.reference.entity_type,
            "source_record_id": link.reference.source_record_id,
        }
        try:
            item["record"] = resolve(company, link.reference.entity_type, link.reference.source_record_id, user)
            item["state"] = "ok"
        except OfficeError as exc:
            item["state"] = "unavailable"
            item["error"] = exc.message
        out.append(item)
    return out
