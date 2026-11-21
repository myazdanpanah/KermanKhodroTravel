"""Nexivo Office — correspondence, workbench and business-link APIs."""

from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.accounts.models import Division, Team, User
from apps.accounts.permissions import RequireModule
from apps.core.responses import (
    business_rule_error,
    forbidden_response,
    validation_error_response,
    not_found_response,
    success_response,
)

from . import business
from .models import Correspondence, Secretariat, SecretariatMember
from .serializers import (
    AttachmentSerializer,
    CommentSerializer,
    CorrespondenceCreateSerializer,
    CorrespondenceDetailSerializer,
    CorrespondenceListSerializer,
    DraftUpdateSerializer,
    SecretariatSerializer,
)
from .services import (
    OfficeError,
    add_attachment,
    can_edit_draft,
    add_comment,
    can_register_letter,
    archive_correspondence,
    can_manage_attachments,
    can_open,
    create_correspondence,
    delete_attachment,
    is_privileged,
    log_action,
    mark_read,
    refer_correspondence,
    register_correspondence,
    reply_to_correspondence,
    update_draft,
    visible_correspondence,
)

_OfficePerm = RequireModule.for_module("office")()


def _gate(request):
    if not _OfficePerm.has_permission(request, None):
        return forbidden_response("Module 'office' is not enabled")
    if not request.user.company_id:
        return forbidden_response("User is not attached to a company")
    return None


def _fail(exc):
    return business_rule_error(exc.message) if exc.status == 400 else Response(
        {"success": False, "message": exc.message, "data": None, "errors": []},
        status=exc.status,
    )


def _letter(request, pk):
    letter = visible_correspondence(request.user).filter(pk=pk).first()
    if letter is None:
        return None, not_found_response("نامه یافت نشد")
    if not can_open(request.user, letter):
        return None, forbidden_response("دسترسی به این نامه مجاز نیست")
    return letter, None


def _base_queryset(user):
    qs = visible_correspondence(user).select_related("secretariat", "owner", "sender_user")
    if not is_privileged(user):
        qs = qs.filter(
            Q(confidentiality__in=["normal", "confidential"])
            | Q(created_by=user)
            | Q(owner=user)
            | Q(recipients__recipient_user=user)
        )
    return qs.distinct()


def _bucket(user, bucket):
    qs = _base_queryset(user)
    if bucket == "drafts":
        return qs.filter(registration_status="draft", archived_at__isnull=True)
    if bucket == "archived":
        return qs.filter(archived_at__isnull=False)
    qs = qs.filter(archived_at__isnull=True)
    if bucket in ("inbox", "all"):
        return qs
    if bucket == "action":
        return qs.filter(
            Q(recipients__recipient_user=user, recipients__delivery_type="action_required")
            | Q(routes__to_user=user, routes__route_status="pending")
        )
    if bucket == "approvals":
        return qs.filter(routes__to_user=user, routes__route_type__in=["review", "signature"],
                         routes__route_status="pending")
    if bucket == "sent":
        return qs.filter(Q(created_by=user) | Q(sender_user=user))
    if bucket == "cc":
        return qs.filter(recipients__recipient_user=user,
                         recipients__delivery_type__in=["cc", "information", "bcc"])
    if bucket == "overdue":
        return qs.filter(due_at__lt=timezone.now()).exclude(current_status__in=["closed", "answered"])
    if bucket == "referred":
        return qs.filter(routes__from_user=user)
    return qs.none()


@api_view(["GET"])
def workbench(request):
    gate = _gate(request)
    if gate:
        return gate
    buckets = {}
    for bucket in ("inbox", "action", "approvals", "sent", "cc", "overdue", "drafts", "archived"):
        buckets[bucket] = _bucket(request.user, bucket).distinct().count()
    return success_response(data={"buckets": buckets, "generated_at": timezone.now().isoformat()})


@api_view(["GET"])
def workbench_list(request):
    gate = _gate(request)
    if gate:
        return gate
    bucket = request.query_params.get("bucket", "inbox")
    qs = _bucket(request.user, bucket).order_by("-created_at")[:200]
    return success_response(data=CorrespondenceListSerializer(qs, many=True).data,
                            meta={"bucket": bucket})


@api_view(["GET", "POST"])
def correspondence_list(request):
    gate = _gate(request)
    if gate:
        return gate
    if request.method == "GET":
        qs = _base_queryset(request.user)
        params = request.query_params
        if params.get("type"):
            qs = qs.filter(correspondence_type=params["type"])
        if params.get("status"):
            qs = qs.filter(current_status=params["status"])
        if params.get("priority"):
            qs = qs.filter(priority=params["priority"])
        if params.get("registration_status"):
            qs = qs.filter(registration_status=params["registration_status"])
        if params.get("archived") != "true":
            qs = qs.filter(archived_at__isnull=True)
        if params.get("q"):
            qs = qs.filter(Q(subject__icontains=params["q"]) | Q(registration_number__icontains=params["q"])
                           | Q(body__icontains=params["q"]))
        if params.get("due_before"):
            qs = qs.filter(due_at__lte=params["due_before"])
        qs = qs.order_by("-created_at")[:200]
        return success_response(data=CorrespondenceListSerializer(qs, many=True).data)

    serializer = CorrespondenceCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = dict(serializer.validated_data)
    recipients = data.pop("recipients", [])
    try:
        letter = create_correspondence(request.user, data, recipients=recipients)
    except OfficeError as exc:
        return business_rule_error(exc.message)
    letter = CorrespondenceDetailSerializer(letter).data
    return success_response(data=letter, message="پیش‌نویس نامه ایجاد شد", http_status_code=201)


@api_view(["GET", "PATCH"])
def correspondence_detail(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error

    if request.method == "GET":
        mark_read(letter, request.user)
        payload = CorrespondenceDetailSerializer(letter).data
        payload["business_links"] = business.links_for(letter.company, "correspondence", letter.id, request.user)
        payload["can_edit"] = can_edit_draft(letter, request.user)
        payload["can_manage_attachments"] = can_manage_attachments(request.user, letter)
        return success_response(data=payload)

    serializer = DraftUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        field_errors = {field: errors[0] for field, errors in serializer.errors.items()}
        return validation_error_response("اطلاعات نامه معتبر نیست", field_errors)
    try:
        letter = update_draft(letter, request.user, dict(serializer.validated_data))
    except OfficeError as exc:
        return _fail(exc)
    return success_response(data=CorrespondenceDetailSerializer(letter).data, message="پیش‌نویس به‌روزرسانی شد")


@api_view(["POST"])
def correspondence_register(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    if not can_register_letter(request.user, letter):
        return forbidden_response("ثبت نامه فقط برای اعضای مجاز دبیرخانه است")
    try:
        letter = register_correspondence(letter, request.user, year=request.data.get("year"))
    except OfficeError as exc:
        return _fail(exc)
    return success_response(
        data=CorrespondenceDetailSerializer(letter).data,
        message=f"نامه با شماره {letter.registration_number} ثبت شد",
    )


@api_view(["POST"])
def correspondence_refer(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    try:
        refer_correspondence(letter, request.user, request.data)
    except OfficeError as exc:
        return _fail(exc)
    return success_response(data=CorrespondenceDetailSerializer(letter).data, message="نامه ارجاع شد")


@api_view(["POST"])
def correspondence_reply(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    try:
        reply = reply_to_correspondence(letter, request.user, request.data.get("body", ""),
                                        request.data.get("subject", ""))
    except OfficeError as exc:
        return _fail(exc)
    return success_response(data=CorrespondenceDetailSerializer(reply).data, message="پاسخ ثبت شد",
                            http_status_code=201)


@api_view(["POST"])
def correspondence_archive(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    if not (is_privileged(request.user) or letter.owner_id == request.user.id
            or letter.created_by_id == request.user.id):
        return forbidden_response("بایگانی نامه فقط توسط مسئول یا سازنده آن مجاز است")
    try:
        archive_correspondence(letter, request.user, request.data.get("note", ""))
    except OfficeError as exc:
        return _fail(exc)
    return success_response(data=CorrespondenceDetailSerializer(letter).data, message="نامه بایگانی شد")


@api_view(["GET", "POST"])
def correspondence_comments(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    if request.method == "GET":
        return success_response(data=CommentSerializer(letter.comments.all(), many=True).data)
    try:
        comment = add_comment(letter, request.user, request.data.get("body", ""),
                              request.data.get("is_internal", True))
    except OfficeError as exc:
        return _fail(exc)
    return success_response(data=CommentSerializer(comment).data, message="یادداشت ثبت شد",
                            http_status_code=201)


@api_view(["GET"])
def correspondence_timeline(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    events = []
    for action in letter.actions.select_related("actor"):
        # A referral is already represented by its route; do not show it twice.
        if action.action == "referred":
            continue
        events.append({
            "kind": "action", "action": action.action,
            "actor": action.actor.get_full_name() if action.actor_id else "",
            "note": action.note, "metadata": action.metadata, "at": action.created_at,
        })
    for route in letter.routes.select_related("from_user", "to_user"):
        events.append({
            "kind": "route", "action": f"ارجاع ({route.get_route_type_display()})",
            "actor": route.from_user.get_full_name() if route.from_user_id else "",
            "note": route.instruction,
            "metadata": {"to": route.to_user.get_full_name() if route.to_user_id else "",
                         "status": route.route_status},
            "at": route.assigned_at,
        })
    for comment in letter.comments.select_related("author"):
        events.append({
            "kind": "comment", "action": "یادداشت",
            "actor": comment.author.get_full_name() if comment.author_id else "",
            "note": comment.body, "metadata": {}, "at": comment.created_at,
        })
    events.sort(key=lambda item: item["at"])
    for event in events:
        event["at"] = event["at"].isoformat()
    return success_response(data=events)


@api_view(["GET", "POST"])
def correspondence_business_links(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    if request.method == "GET":
        return success_response(data=business.links_for(letter.company, "correspondence", letter.id, request.user))
    try:
        business.add_link(
            letter.company,
            request.user,
            "correspondence",
            letter.id,
            request.data.get("entity_type"),
            request.data.get("source_record_id"),
            request.data.get("relationship_type", "about"),
            request.data.get("label", ""),
        )
    except OfficeError as exc:
        return _fail(exc)
    return success_response(
        data=business.links_for(letter.company, "correspondence", letter.id, request.user),
        message="رکورد مالی پیوند شد",
        http_status_code=201,
    )


@api_view(["DELETE"])
def correspondence_business_link_delete(request, pk, link_id):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    from .models import OfficeBusinessLink

    link = OfficeBusinessLink.objects.filter(
        pk=link_id, company=letter.company, office_object_type="correspondence",
        office_object_id=str(letter.id),
    ).first()
    if link is None:
        return not_found_response("پیوند یافت نشد")
    link.delete()
    return success_response(message="پیوند حذف شد")


@api_view(["GET"])
def office_meta(request):
    gate = _gate(request)
    if gate:
        return gate
    company = request.user.company
    users = (
        User.objects.filter(company=company, is_active=True)
        .select_related("division", "team")
        .order_by("first_name", "username")
    )
    return success_response(data={
        "secretariats": SecretariatSerializer(
            Secretariat.objects.filter(company=company, is_active=True), many=True).data,
        "users": [
            {
                "id": user.id,
                "name": user.get_full_name() or user.username,
                "username": user.username,
                "role": user.role,
                "email": user.email,
                "division": user.division_id,
                "division_name": user.division.name if user.division_id else "",
                "team_name": user.team.name if user.team_id else "",
            }
            for user in users
        ],
        "teams": [
            {"id": team.id, "name": team.name, "division": team.division.name}
            for team in Team.objects.filter(division__company=company).select_related("division")
        ],
        "divisions": [
            {"id": division.id, "name": division.name}
            for division in Division.objects.filter(company=company)
        ],
        "types": [{"value": value, "label": label} for value, label in Correspondence.TYPE_CHOICES],
        "statuses": [{"value": value, "label": label} for value, label in Correspondence.STATUS_CHOICES],
        "priorities": [{"value": value, "label": label} for value, label in Correspondence.PRIORITY_CHOICES],
        "confidentialities": [
            {"value": value, "label": label} for value, label in Correspondence.CONFIDENTIALITY_CHOICES
        ],
        "capabilities": {
            "privileged": is_privileged(request.user),
            "view_financials": business.can_see_financials(request.user),
            "register_secretariat_ids": list(
                SecretariatMember.objects.filter(user=request.user, can_register=True)
                .values_list("secretariat_id", flat=True)
            ),
        },
    })


@api_view(["GET"])
def integration_health(request):
    gate = _gate(request)
    if gate:
        return gate
    company = request.user.company
    from apps.crm.models import Opportunity
    from apps.finance.models import Customer, Invoice, Receipt

    return success_response(data={
        "source": "nexivo_business",
        "mode": "read_only_in_process",
        "read_at": timezone.now().isoformat(),
        "counts": {
            "customer": Customer.objects.filter(company=company).count(),
            "invoice": Invoice.objects.filter(company=company).count(),
            "receipt": Receipt.objects.filter(company=company).count(),
            "opportunity": Opportunity.objects.filter(company=company).count(),
        },
    })


@api_view(["GET"])
def integration_search(request):
    gate = _gate(request)
    if gate:
        return gate
    entity_type = request.query_params.get("entity_type", "customer")
    try:
        results = business.search(request.user.company, entity_type, request.query_params.get("q", ""),
                                  request.user)
    except OfficeError as exc:
        return _fail(exc)
    return success_response(data=results, meta={"entity_type": entity_type})


@api_view(["GET"])
def integration_record(request, entity_type, record_id):
    gate = _gate(request)
    if gate:
        return gate
    try:
        dto = business.resolve(request.user.company, entity_type, record_id, request.user)
    except OfficeError as exc:
        return _fail(exc)
    return success_response(data=dto)


@api_view(["GET", "POST"])
def secretariat_list(request):
    gate = _gate(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        rows = Secretariat.objects.filter(company=company).prefetch_related("members__user")
        return success_response(data=[{
            "id": row.id,
            "name": row.name,
            "code": row.code,
            "is_active": row.is_active,
            "members": [
                {"id": member.id, "user": member.user_id,
                 "user_name": member.user.get_full_name() or member.user.username,
                 "can_register": member.can_register}
                for member in row.members.all()
            ],
        } for row in rows])

    if not is_privileged(request.user):
        return forbidden_response("ایجاد دبیرخانه فقط برای مدیران مجاز است")
    name = (request.data.get("name") or "").strip()
    code = (request.data.get("code") or "").strip().upper()
    if not name or not code:
        return business_rule_error("نام و کد دبیرخانه الزامی است")
    secretariat, created = Secretariat.objects.get_or_create(
        company=company, code=code, defaults={"name": name, "created_by": request.user},
    )
    if not created:
        return business_rule_error("دبیرخانه‌ای با این کد وجود دارد")
    return success_response(data=SecretariatSerializer(secretariat).data, message="دبیرخانه ایجاد شد",
                            http_status_code=201)


@api_view(["POST", "DELETE"])
def secretariat_member(request, pk):
    gate = _gate(request)
    if gate:
        return gate
    secretariat = Secretariat.objects.filter(pk=pk, company=request.user.company).first()
    if secretariat is None:
        return not_found_response("دبیرخانه یافت نشد")
    if not is_privileged(request.user):
        return forbidden_response("مدیریت اعضای دبیرخانه فقط برای مدیران مجاز است")

    if request.method == "POST":
        user = User.objects.filter(pk=request.data.get("user_id"), company=secretariat.company,
                                   is_active=True).first()
        if user is None:
            return business_rule_error("کاربر انتخاب‌شده در این شرکت فعال نیست")
        member, _ = SecretariatMember.objects.get_or_create(
            secretariat=secretariat, user=user,
            defaults={"can_register": bool(request.data.get("can_register", True))},
        )
        if "can_register" in request.data:
            member.can_register = bool(request.data["can_register"])
            member.save(update_fields=["can_register"])
        return success_response(data={"id": member.id, "can_register": member.can_register},
                                message="عضو دبیرخانه ثبت شد", http_status_code=201)

    member = SecretariatMember.objects.filter(
        pk=request.data.get("member_id"), secretariat=secretariat,
    ).first()
    if member is None:
        return not_found_response("عضو یافت نشد")
    member.delete()
    return success_response(message="عضو حذف شد")


@api_view(["GET", "POST"])
def correspondence_attachments(request, pk):
    """List or upload private attachments for a letter."""
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    if request.method == "GET":
        attachments = letter.attachments.select_related("uploaded_by")
        return success_response(data=AttachmentSerializer(attachments, many=True).data)
    upload = request.FILES.get("file")
    if upload is None:
        return business_rule_error("فایلی انتخاب نشده است")
    try:
        attachment = add_attachment(letter, request.user, upload)
    except OfficeError as exc:
        return _fail(exc)
    return success_response(
        data=AttachmentSerializer(attachment).data,
        message="پیوست افزوده شد",
        http_status_code=201,
    )


@api_view(["DELETE"])
def correspondence_attachment_delete(request, pk, attachment_id):
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    attachment = letter.attachments.filter(pk=attachment_id).first()
    if attachment is None:
        return not_found_response("پیوست یافت نشد")
    try:
        delete_attachment(attachment, request.user)
    except OfficeError as exc:
        return _fail(exc)
    return success_response(data=None, message="پیوست حذف شد")


@api_view(["GET"])
def correspondence_attachment_download(request, pk, attachment_id):
    """Stream one private file after the same access checks as the letter."""
    gate = _gate(request)
    if gate:
        return gate
    letter, error = _letter(request, pk)
    if error:
        return error
    attachment = letter.attachments.filter(pk=attachment_id, company=letter.company).first()
    if attachment is None:
        return not_found_response("پیوست یافت نشد")
    try:
        handle = attachment.file.open("rb")
    except (FileNotFoundError, OSError):
        return not_found_response("فایل پیوست در دسترس نیست")
    response = FileResponse(
        handle,
        as_attachment=True,
        filename=attachment.original_name,
        content_type=attachment.content_type or "application/octet-stream",
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    # Even a file that would render in a browser cannot run script or frame
    # itself: it is a download, not a page.
    response["Content-Security-Policy"] = "default-src 'none'; sandbox"
    response["X-Frame-Options"] = "DENY"
    log_action(
        letter, request.user, "attachment_downloaded",
        metadata={"attachment_id": attachment.id},
    )
    return response
