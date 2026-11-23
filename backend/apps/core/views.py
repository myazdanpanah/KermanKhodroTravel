"""Core system-wide APIs including global cross-system search."""

from __future__ import annotations

import logging
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger("core.search")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def global_search_view(request):
    """
    Unified global search endpoint across all system entities:
    - Office Correspondence (letters)
    - Billing Invoices & Payments
    - Payers & Customers
    - CRM Leads & Opportunities
    - Users & Staff
    - Contracts
    """
    q = str(request.query_params.get("q") or "").strip()
    user = request.user
    company = getattr(user, "company", None)

    # Explicit console output so developer/admin sees search activity in backend terminal logs
    print(f"[GlobalSearch] Query: '{q}' from user: '{user.username}' (role: {getattr(user, 'role', '')})", flush=True)
    logger.info(f"[GlobalSearch] Query: '{q}' from user: '{user.username}'")

    if not q:
        return Response({
            "success": True,
            "query": "",
            "total": 0,
            "results": [],
        })

    results = []

    # 1. Office Correspondence
    try:
        from apps.office.models import Correspondence
        letters = Correspondence.objects.filter(is_deleted=False)
        if company:
            letters = letters.filter(company=company)
        letters = letters.filter(
            Q(subject__icontains=q)
            | Q(registration_number__icontains=q)
            | Q(sender_name__icontains=q)
            | Q(sender_organization__icontains=q)
            | Q(body__icontains=q)
        ).select_related("secretariat")[:8]

        for item in letters:
            sender_str = item.sender_display if hasattr(item, "sender_display") else (item.sender_name or item.sender_organization or "—")
            results.append({
                "key": f"letter-{item.id}",
                "category": "correspondence",
                "category_label": "مکاتبات اداری",
                "title": item.subject,
                "subtitle": f"شماره: {item.registration_number or 'پیش‌نویس'} · فرستنده: {sender_str}",
                "to": f"/erp/office/correspondence/{item.id}",
            })
    except Exception as exc:
        logger.warning(f"GlobalSearch correspondence error: {exc}")

    # 2. Billing Invoices
    try:
        from apps.billing.models import Invoice
        invoices = Invoice.objects.filter(
            Q(letter_number__icontains=q)
            | Q(payer__icontains=q)
            | Q(payer_code__icontains=q)
            | Q(invoice_type__icontains=q)
            | Q(description__icontains=q)
        )[:6]

        for item in invoices:
            amount_str = f"{int(item.amount or 0):,} ریال"
            results.append({
                "key": f"invoice-{item.id}",
                "category": "invoice",
                "category_label": "صورت‌حساب مالی",
                "title": f"صورت‌حساب {item.letter_number} ({item.invoice_type})",
                "subtitle": f"طرف‌حساب: {item.payer} (کد {item.payer_code}) · مبلغ: {amount_str}",
                "to": f"/erp/billing/invoices?search={item.letter_number}",
            })
    except Exception as exc:
        logger.warning(f"GlobalSearch invoice error: {exc}")

    # 3. Billing Payments
    try:
        from apps.billing.models import Payment
        payments = Payment.objects.filter(
            Q(tracking_number__icontains=q)
            | Q(payment_code__icontains=q)
            | Q(payer_name__icontains=q)
            | Q(payer_code__icontains=q)
            | Q(description__icontains=q)
        )[:6]

        for item in payments:
            amount_str = f"{int(item.amount or 0):,} ریال"
            track_or_code = item.tracking_number or item.payment_code or str(item.id)
            results.append({
                "key": f"payment-{item.id}",
                "category": "payment",
                "category_label": "پرداخت و تراکنش",
                "title": f"پرداخت پیگیری {track_or_code}",
                "subtitle": f"طرف‌حساب: {item.payer_name} (کد {item.payer_code}) · مبلغ: {amount_str}",
                "to": f"/erp/billing/payments?search={track_or_code}",
            })
    except Exception as exc:
        logger.warning(f"GlobalSearch payment error: {exc}")

    # 4. Payers & Customers
    try:
        from apps.billing.models import Payer
        payers = Payer.objects.filter(
            Q(name__icontains=q)
            | Q(code__icontains=q)
            | Q(national_id__icontains=q)
            | Q(economic_code__icontains=q)
        )[:6]

        for item in payers:
            results.append({
                "key": f"payer-{item.code}",
                "category": "customer",
                "category_label": "طرف‌حساب و شرکت",
                "title": item.name,
                "subtitle": f"کد شرکت: {item.code} · شناسه ملی: {item.national_id or '—'}",
                "to": f"/erp/billing/payers?search={item.name}",
            })
    except Exception as exc:
        logger.warning(f"GlobalSearch payer error: {exc}")

    # 5. CRM Leads
    try:
        from apps.crm.models import Lead
        leads = Lead.objects.all()
        if company:
            leads = leads.filter(company=company)
        leads = leads.filter(
            Q(name__icontains=q)
            | Q(company_name__icontains=q)
            | Q(mobile__icontains=q)
            | Q(phone__icontains=q)
            | Q(email__icontains=q)
        )[:6]

        for item in leads:
            results.append({
                "key": f"lead-{item.id}",
                "category": "crm",
                "category_label": "سرنخ CRM",
                "title": item.name,
                "subtitle": f"شرکت: {item.company_name or '—'} · تماس: {item.mobile or item.phone or '—'}",
                "to": "/erp/crm/leads",
            })
    except Exception as exc:
        logger.warning(f"GlobalSearch lead error: {exc}")

    # 6. Users & Staff
    try:
        from apps.accounts.models import User
        users = User.objects.all()
        if company:
            users = users.filter(company=company)
        users = users.filter(
            Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(username__icontains=q)
            | Q(department__icontains=q)
        )[:6]

        for item in users:
            full_name = item.get_full_name() or item.username
            results.append({
                "key": f"user-{item.id}",
                "category": "user",
                "category_label": "کاربران و پرسنل",
                "title": full_name,
                "subtitle": f"نام کاربری: {item.username} · واحد: {item.department or item.role or '—'}",
                "to": "/erp/settings/users",
            })
    except Exception as exc:
        logger.warning(f"GlobalSearch user error: {exc}")

    # 7. Contracts
    try:
        from apps.office.models import Contract
        contracts = Contract.objects.all()
        if company:
            contracts = contracts.filter(company=company)
        contracts = contracts.filter(
            Q(title__icontains=q)
            | Q(contract_number__icontains=q)
            | Q(counterparty__icontains=q)
        )[:6]

        for item in contracts:
            results.append({
                "key": f"contract-{item.id}",
                "category": "contract",
                "category_label": "قرارداد",
                "title": item.title,
                "subtitle": f"شماره قرارداد: {item.contract_number} · طرف: {item.counterparty}",
                "to": "/erp/office/contracts",
            })
    except Exception as exc:
        logger.warning(f"GlobalSearch contract error: {exc}")

    print(f"[GlobalSearch] Found {len(results)} matches for '{q}'", flush=True)

    return Response({
        "success": True,
        "query": q,
        "total": len(results),
        "results": results,
    })
