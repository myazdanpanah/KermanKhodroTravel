import uuid
import mimetypes
from datetime import timedelta
from django.db import transaction, models
from django.db.models import Q
from django.utils import timezone
from django.http import HttpResponse, FileResponse, Http404
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.messaging.models import (
    Conversation,
    ConversationMembership,
    Channel,
    Message,
    Attachment,
    Reaction,
    Announcement,
    AnnouncementAcknowledgment,
)
from apps.messaging.api.permissions import (
    IsActiveCompanyUser,
    CanAccessConversation,
    CanManageGroup,
)
from apps.messaging.api.serializers import (
    UserMinimalSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
    ConversationMembershipSerializer,
    ChannelSerializer,
    MessageSerializer,
    DirectConversationCreateSerializer,
    GroupConversationCreateSerializer,
    MessageSendSerializer,
    AttachmentSerializer,
    ReactionSerializer,
    AnnouncementSerializer,
    AnnouncementCreateSerializer,
)
from apps.messaging.services.conversation_service import (
    get_or_create_direct_conversation,
    create_group_conversation,
    sync_department_conversation,
)
from apps.messaging.services.message_service import (
    send_message,
    edit_message,
    delete_message,
    add_reaction,
    remove_reaction,
    advance_read_cursor,
)
from apps.messaging.services.presence_service import (
    get_users_presence,
    update_user_presence,
    get_typing_users,
)

User = get_user_model()


class UserDirectoryView(APIView):
    """List searchable permitted users from the same company for starting conversations."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request):
        company_id = request.user.company_id
        q = request.query_params.get("q", "").strip()
        qs = User.objects.filter(company_id=company_id, is_active=True).exclude(id=request.user.id)
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(department__icontains=q)
            )
        users = qs.order_by("first_name", "last_name")[:50]
        data = UserMinimalSerializer(users, many=True).data
        # Attach presence
        presence_map = get_users_presence(company_id, [u["id"] for u in data])
        for u in data:
            u["presence"] = presence_map.get(u["id"], "offline")
        return Response(data)


class ConversationListView(APIView):
    """List conversations where the user is an active member."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request):
        user = request.user
        company_id = user.company_id

        # Update requester presence heartbeat
        update_user_presence(company_id, user.id, "online")

        # Get active conversation IDs for user
        conv_ids = ConversationMembership.objects.filter(
            company_id=company_id,
            user=user,
            state="ACTIVE",
            is_archived=False,
        ).values_list("conversation_id", flat=True)

        conversations = (
            Conversation.objects.filter(id__in=conv_ids, company_id=company_id)
            .prefetch_related("memberships__user", "channels")
            .order_by("-last_message_at", "-created_at")
        )

        serializer = ConversationListSerializer(conversations, many=True, context={"request": request})
        return Response(serializer.data)


class ConversationDetailView(APIView):
    """Retrieve or update metadata of a specific conversation."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request, pk):
        user = request.user
        conv = Conversation.objects.filter(id=pk, company_id=user.company_id).first()
        if not conv:
            raise Http404()

        # Check membership
        if not ConversationMembership.objects.filter(conversation=conv, user=user, state="ACTIVE").exists():
            return Response({"detail": "دسترسی به این گفتگو ندارید."}, status=status.HTTP_403_FORBIDDEN)

        serializer = ConversationDetailSerializer(conv, context={"request": request})
        data = serializer.data
        # Attach typing users
        data["typing_user_ids"] = get_typing_users(user.company_id, str(conv.id))
        return Response(data)

    def patch(self, request, pk):
        user = request.user
        conv = Conversation.objects.filter(id=pk, company_id=user.company_id).first()
        if not conv:
            raise Http404()

        membership = ConversationMembership.objects.filter(conversation=conv, user=user, state="ACTIVE").first()
        if not membership or membership.role not in ("OWNER", "MODERATOR"):
            if getattr(user, "role", "") not in ("admin", "ceo"):
                return Response({"detail": "مجوز ویرایش اطلاعات گروه را ندارید."}, status=status.HTTP_403_FORBIDDEN)

        title = request.data.get("title")
        description = request.data.get("description")
        update_fields = []
        if title:
            conv.title = title
            update_fields.append("title")
        if description is not None:
            conv.description = description
            update_fields.append("description")

        if update_fields:
            update_fields.append("updated_at")
            conv.save(update_fields=update_fields)

        return Response(ConversationDetailSerializer(conv, context={"request": request}).data)


class DirectConversationCreateView(APIView):
    """Retrieve or create canonical 1-to-1 conversation."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request):
        ser = DirectConversationCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        target_user_id = ser.validated_data["user_id"]
        target_user = User.objects.filter(
            id=target_user_id,
            company_id=request.user.company_id,
            is_active=True,
        ).first()

        if not target_user:
            return Response({"detail": "کاربر مورد نظر یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

        try:
            conv, created = get_or_create_direct_conversation(
                company_id=request.user.company_id,
                user_a=request.user,
                user_b=target_user,
            )
            data = ConversationDetailSerializer(conv, context={"request": request}).data
            data["created"] = created
            return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GroupConversationCreateView(APIView):
    """Create group, department, or project conversation."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request):
        ser = GroupConversationCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        data = ser.validated_data
        conv = create_group_conversation(
            company_id=request.user.company_id,
            creator=request.user,
            title=data["title"],
            description=data.get("description", ""),
            member_ids=data.get("member_ids", []),
            kind=data.get("kind", "GROUP"),
            division_id=data.get("division_id"),
            is_private=data.get("is_private", True),
        )

        return Response(
            ConversationDetailSerializer(conv, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ConversationLeaveView(APIView):
    """Leave group conversation."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request, pk):
        user = request.user
        membership = ConversationMembership.objects.filter(
            conversation_id=pk,
            company_id=user.company_id,
            user=user,
            state="ACTIVE",
        ).first()

        if not membership:
            return Response({"detail": "شما عضو این گفتگو نیستید."}, status=status.HTTP_404_NOT_FOUND)

        if membership.role == "OWNER":
            other_members = ConversationMembership.objects.filter(
                conversation_id=pk, state="ACTIVE"
            ).exclude(user=user)
            if other_members.exists():
                return Response(
                    {"detail": "مالک گروه قبل از خروج باید مالکیت را منتقل کند."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        membership.state = "LEFT"
        membership.left_at = timezone.now()
        membership.save(update_fields=["state", "left_at", "updated_at"])
        return Response({"status": "left"})


class ConversationTogglePinView(APIView):
    """Toggle pin state for the current user."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request, pk):
        membership = ConversationMembership.objects.filter(
            conversation_id=pk, company_id=request.user.company_id, user=request.user, state="ACTIVE"
        ).first()
        if not membership:
            return Response({"detail": "عضویت یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        membership.is_pinned = not membership.is_pinned
        membership.save(update_fields=["is_pinned", "updated_at"])
        return Response({"is_pinned": membership.is_pinned})


class ConversationToggleArchiveView(APIView):
    """Toggle archive state for the current user."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request, pk):
        membership = ConversationMembership.objects.filter(
            conversation_id=pk, company_id=request.user.company_id, user=request.user
        ).first()
        if not membership:
            return Response({"detail": "عضویت یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        membership.is_archived = not membership.is_archived
        membership.save(update_fields=["is_archived", "updated_at"])
        return Response({"is_archived": membership.is_archived})


class ConversationMuteView(APIView):
    """Mute conversation notifications for user."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request, pk):
        membership = ConversationMembership.objects.filter(
            conversation_id=pk, company_id=request.user.company_id, user=request.user, state="ACTIVE"
        ).first()
        if not membership:
            return Response({"detail": "عضویت یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

        minutes = request.data.get("minutes", 60)
        if minutes == 0:
            membership.notifications_muted_until = None
        else:
            membership.notifications_muted_until = timezone.now() + timedelta(minutes=int(minutes))
        membership.save(update_fields=["notifications_muted_until", "updated_at"])
        return Response({"muted_until": membership.notifications_muted_until})


class ConversationMembersView(APIView):
    """List or add members in a conversation."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request, pk):
        conv = Conversation.objects.filter(id=pk, company_id=request.user.company_id).first()
        if not conv:
            raise Http404()
        memberships = conv.memberships.filter(state="ACTIVE").select_related("user")
        return Response(ConversationMembershipSerializer(memberships, many=True).data)

    def post(self, request, pk):
        conv = Conversation.objects.filter(id=pk, company_id=request.user.company_id).first()
        if not conv:
            raise Http404()

        current_m = conv.memberships.filter(user=request.user, state="ACTIVE").first()
        if not current_m or current_m.role not in ("OWNER", "MODERATOR"):
            if getattr(request.user, "role", "") not in ("admin", "ceo"):
                return Response({"detail": "مجوز افزودن کاربر ندارید."}, status=status.HTTP_403_FORBIDDEN)

        user_ids = request.data.get("user_ids", [])
        role = request.data.get("role", "MEMBER")

        users_to_add = User.objects.filter(
            id__in=user_ids,
            company_id=request.user.company_id,
            is_active=True,
        )

        added = []
        for u in users_to_add:
            m, created = ConversationMembership.objects.update_or_create(
                conversation=conv,
                user=u,
                defaults={
                    "company_id": request.user.company_id,
                    "state": "ACTIVE",
                    "role": role,
                    "left_at": None,
                    "added_by": request.user,
                },
            )
            added.append(u.id)

        return Response({"added_count": len(added), "added_user_ids": added})


class ConversationMemberDetailView(APIView):
    """Remove member or update their role."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def delete(self, request, pk, user_id):
        conv = Conversation.objects.filter(id=pk, company_id=request.user.company_id).first()
        if not conv:
            raise Http404()

        current_m = conv.memberships.filter(user=request.user, state="ACTIVE").first()
        if not current_m or current_m.role not in ("OWNER", "MODERATOR"):
            if getattr(request.user, "role", "") not in ("admin", "ceo"):
                return Response({"detail": "مجوز حذف کاربر ندارید."}, status=status.HTTP_403_FORBIDDEN)

        target_m = conv.memberships.filter(user_id=user_id, state="ACTIVE").first()
        if not target_m:
            return Response({"detail": "عضو یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

        if target_m.role == "OWNER":
            return Response({"detail": "مالک گروه قابل حذف نیست."}, status=status.HTTP_400_BAD_REQUEST)

        target_m.state = "REMOVED"
        target_m.left_at = timezone.now()
        target_m.save(update_fields=["state", "left_at", "updated_at"])
        return Response({"status": "removed"})


class ChannelListCreateView(APIView):
    """List or create channels inside a conversation."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request, pk):
        conv = Conversation.objects.filter(id=pk, company_id=request.user.company_id).first()
        if not conv:
            raise Http404()
        channels = conv.channels.filter(is_archived=False)
        return Response(ChannelSerializer(channels, many=True).data)

    def post(self, request, pk):
        conv = Conversation.objects.filter(id=pk, company_id=request.user.company_id).first()
        if not conv:
            raise Http404()

        name = request.data.get("name", "").strip()
        slug = request.data.get("slug", "").strip() or name.lower().replace(" ", "-")
        description = request.data.get("description", "")
        visibility = request.data.get("visibility", "GROUP")

        if not name:
            return Response({"detail": "نام کانال الزامی است."}, status=status.HTTP_400_BAD_REQUEST)

        channel = Channel.objects.create(
            company_id=request.user.company_id,
            conversation=conv,
            name=name,
            slug=slug,
            description=description,
            visibility=visibility,
            created_by=request.user,
        )
        return Response(ChannelSerializer(channel).data, status=status.HTTP_201_CREATED)


class MessageListCreateView(APIView):
    """Cursor-paginated message timeline and send message endpoint."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request, pk):
        conv = Conversation.objects.filter(id=pk, company_id=request.user.company_id).first()
        if not conv:
            raise Http404()

        # Check membership
        if not ConversationMembership.objects.filter(conversation=conv, user=request.user, state="ACTIVE").exists():
            return Response({"detail": "دسترسی ندارید."}, status=status.HTTP_403_FORBIDDEN)

        channel_id = request.query_params.get("channel_id")
        limit = min(int(request.query_params.get("limit", 50)), 100)
        before_seq = request.query_params.get("before_seq")
        after_seq = request.query_params.get("after_seq")

        qs = conv.messages.filter(deleted_at__isnull=True).select_related("sender").prefetch_related("attachments", "reactions")

        if channel_id:
            qs = qs.filter(channel_id=channel_id)

        if before_seq:
            qs = qs.filter(sequence__lt=int(before_seq)).order_by("-sequence")[:limit]
            messages = list(reversed(qs))
        elif after_seq:
            qs = qs.filter(sequence__gt=int(after_seq)).order_by("sequence")[:limit]
            messages = list(qs)
        else:
            # Latest messages
            qs = qs.order_by("-sequence")[:limit]
            messages = list(reversed(qs))

        # Auto-advance read cursor
        if messages:
            last_msg = messages[-1]
            advance_read_cursor(request.user, last_msg.id)

        return Response(MessageSerializer(messages, many=True).data)

    def post(self, request, pk):
        ser = MessageSendSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            msg = send_message(
                company_id=request.user.company_id,
                sender=request.user,
                conversation_id=pk,
                content=data["content"],
                client_message_id=data.get("client_message_id"),
                channel_id=data.get("channel_id"),
                root_message_id=data.get("root_message_id"),
                attachment_ids=data.get("attachment_ids"),
                message_type=data.get("message_type", "TEXT"),
                content_format=data.get("content_format", "PLAIN"),
                metadata=data.get("metadata", {}),
            )
            return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MessageDetailView(APIView):
    """Retrieve, edit, or delete a message."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def patch(self, request, pk):
        content = request.data.get("content", "").strip()
        if not content:
            return Response({"detail": "متن پیام نمی‌تواند خالی باشد."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            msg = edit_message(request.user, pk, content)
            return Response(MessageSerializer(msg).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            msg = delete_message(request.user, pk)
            return Response({"status": "deleted", "id": str(msg.id)})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MessageThreadView(APIView):
    """Get replies to a root thread message."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request, pk):
        root_msg = Message.objects.filter(id=pk, company_id=request.user.company_id).first()
        if not root_msg:
            raise Http404()

        replies = root_msg.replies.filter(deleted_at__isnull=True).select_related("sender").order_by("sequence")
        return Response({
            "root": MessageSerializer(root_msg).data,
            "replies": MessageSerializer(replies, many=True).data,
        })


class MessageReactionView(APIView):
    """Add emoji reaction."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request, pk):
        emoji = request.data.get("emoji", "").strip()
        if not emoji:
            return Response({"detail": "ایموجی الزامی است."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            reaction = add_reaction(request.user, pk, emoji)
            return Response(ReactionSerializer(reaction).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MessageReactionDeleteView(APIView):
    """Remove emoji reaction."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def delete(self, request, pk, reaction_id):
        try:
            remove_reaction(request.user, reaction_id)
            return Response({"status": "removed"})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MessageReadView(APIView):
    """Explicitly advance read cursor."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request, pk):
        try:
            m = advance_read_cursor(request.user, pk)
            return Response({"last_read_sequence": m.last_read_sequence})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AttachmentUploadView(APIView):
    """Initiate and upload private attachment."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request):
        conversation_id = request.data.get("conversation_id")
        file_obj = request.FILES.get("file")

        if not conversation_id or not file_obj:
            return Response({"detail": "فایل و شناسه گفتگو الزامی هستند."}, status=status.HTTP_400_BAD_REQUEST)

        conv = Conversation.objects.filter(id=conversation_id, company_id=request.user.company_id).first()
        if not conv:
            raise Http404()

        # Check size (default 25 MB)
        max_size = 25 * 1024 * 1024
        if file_obj.size > max_size:
            return Response({"detail": "حجم فایل بیشتر از حد مجاز (۲۵ مگابایت) است."}, status=status.HTTP_400_BAD_REQUEST)

        content_type = file_obj.content_type or mimetypes.guess_type(file_obj.name)[0] or "application/octet-stream"

        attachment = Attachment.objects.create(
            company_id=request.user.company_id,
            conversation=conv,
            uploaded_by=request.user,
            file=file_obj,
            original_filename=file_obj.name,
            mime_type=content_type,
            file_size=file_obj.size,
            status="PENDING",
        )

        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class AttachmentDownloadView(APIView):
    """Authorized streaming download of private attachment."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request, pk):
        attachment = Attachment.objects.select_related("conversation").filter(
            id=pk,
            company_id=request.user.company_id,
            status__in=["AVAILABLE", "PENDING"],
        ).first()

        if not attachment:
            raise Http404()

        # Verify user is active member of conversation
        is_member = ConversationMembership.objects.filter(
            conversation=attachment.conversation,
            user=request.user,
            state="ACTIVE",
        ).exists()

        if not is_member and getattr(request.user, "role", "") not in ("admin", "ceo"):
            return Response({"detail": "دسترسی به این فایل ندارید."}, status=status.HTTP_403_FORBIDDEN)

        response = FileResponse(attachment.file.open("rb"), content_type=attachment.mime_type)
        response["Content-Disposition"] = f'attachment; filename="{attachment.original_filename}"'
        return response


class AnnouncementListCreateView(APIView):
    """List visible announcements or create a privileged announcement."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request):
        company_id = request.user.company_id
        announcements = Announcement.objects.filter(company_id=company_id).select_related("message", "created_by")
        return Response(AnnouncementSerializer(announcements, many=True, context={"request": request}).data)

    def post(self, request):
        ser = AnnouncementCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        conv = Conversation.objects.filter(id=data["conversation_id"], company_id=request.user.company_id).first()
        if not conv:
            raise Http404()

        # Create announcement message
        msg = send_message(
            company_id=request.user.company_id,
            sender=request.user,
            conversation_id=conv.id,
            content=data["content"],
            message_type="ANNOUNCEMENT",
        )

        ann = Announcement.objects.create(
            company_id=request.user.company_id,
            message=msg,
            conversation=conv,
            priority=data.get("priority", "NORMAL"),
            scope_type=data.get("scope_type", "GROUP"),
            requires_acknowledgment=data.get("requires_acknowledgment", False),
            created_by=request.user,
        )

        return Response(AnnouncementSerializer(ann, context={"request": request}).data, status=status.HTTP_201_CREATED)


class AnnouncementAcknowledgeView(APIView):
    """Acknowledge an announcement."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request, pk):
        ann = Announcement.objects.filter(id=pk, company_id=request.user.company_id).first()
        if not ann:
            raise Http404()

        ack, created = AnnouncementAcknowledgment.objects.get_or_create(
            company_id=request.user.company_id,
            announcement=ann,
            user=request.user,
        )
        return Response({"acknowledged": True, "created": created})


class SearchMessagesView(APIView):
    """Search messages accessible to current user."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request):
        user = request.user
        company_id = user.company_id
        q = request.query_params.get("q", "").strip()

        if not q:
            return Response([])

        # Inaccessible conversations are strictly excluded
        user_conv_ids = ConversationMembership.objects.filter(
            company_id=company_id,
            user=user,
            state="ACTIVE",
        ).values_list("conversation_id", flat=True)

        messages = (
            Message.objects.filter(
                company_id=company_id,
                conversation_id__in=user_conv_ids,
                deleted_at__isnull=True,
                content__icontains=q,
            )
            .select_related("sender", "conversation")
            .order_by("-created_at")[:50]
        )

        return Response(MessageSerializer(messages, many=True).data)


class DepartmentSyncView(APIView):
    """Synchronize department conversation from Division."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def post(self, request, division_id):
        if getattr(request.user, "role", "") not in ("admin", "ceo") and not getattr(request.user, "can_manage_users", False):
            return Response({"detail": "مجوز همگام‌سازی دپارتمان ندارید."}, status=status.HTTP_403_FORBIDDEN)
        try:
            conv = sync_department_conversation(division_id)
            return Response(ConversationDetailSerializer(conv, context={"request": request}).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EntitySearchView(APIView):
    """
    Search cross-system entities (Office Correspondence letters, Billing Invoices, Billing Payments)
    to link/attach within Orbit messaging.
    """
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request):
        entity_type = request.query_params.get("type", "correspondence").lower()
        q = request.query_params.get("q", "").strip()
        limit = min(int(request.query_params.get("limit", 20)), 50)
        results = []

        if entity_type == "correspondence":
            from apps.office.models import Correspondence
            qs = Correspondence.objects.all()
            if request.user.company_id:
                qs = qs.filter(company_id=request.user.company_id)
            if q:
                qs = qs.filter(
                    Q(subject__icontains=q)
                    | Q(registration_number__icontains=q)
                    | Q(sender_name__icontains=q)
                    | Q(body__icontains=q)
                )
            qs = qs.order_by("-registered_at", "-created_at")

            for c in qs[:limit]:
                badge = "نامه صادره" if c.correspondence_type == "outgoing" else dict(Correspondence.TYPE_CHOICES).get(c.correspondence_type, "نامه اداری")
                status_lbl = dict(Correspondence.REGISTRATION_CHOICES).get(c.registration_status, c.registration_status)
                date_str = c.letter_date_jalali or (c.letter_date.strftime("%Y/%m/%d") if c.letter_date else "")
                results.append({
                    "entity_type": "correspondence",
                    "entity_id": str(c.id),
                    "title": c.subject or f"نامه {c.registration_number or c.id}",
                    "code": c.registration_number or f"پیش‌نویس #{c.id}",
                    "date": date_str,
                    "badge": badge,
                    "status": status_lbl,
                    "subtitle": f"فرستنده: {c.sender_name or (c.sender_user.get_full_name() if c.sender_user else 'سازمان')}",
                    "preview_url": f"/api/v1/office/correspondence/{c.id}/",
                    "download_url": f"/api/v1/office/correspondence/{c.id}/",
                    "body_snippet": (c.body[:150] + "...") if len(c.body) > 150 else c.body,
                })

        elif entity_type == "invoice":
            from apps.billing.models import Invoice
            qs = Invoice.objects.filter(reversed_at__isnull=True)
            if q:
                qs = qs.filter(
                    Q(letter_number__icontains=q)
                    | Q(payer__icontains=q)
                    | Q(payer_code__icontains=q)
                    | Q(invoice_type__icontains=q)
                )
            qs = qs.order_by("-issue_date", "-id")

            for inv in qs[:limit]:
                date_str = inv.issue_date.strftime("%Y/%m/%d") if inv.issue_date else ""
                results.append({
                    "entity_type": "invoice",
                    "entity_id": str(inv.id),
                    "title": f"صورت‌حساب {inv.invoice_type} - {inv.payer}",
                    "code": inv.letter_number,
                    "date": date_str,
                    "amount": inv.amount,
                    "period_range": inv.period_range or "",
                    "badge": "صورت‌حساب مالی",
                    "status": "معتبر",
                    "subtitle": f"مشتری: {inv.payer} (کد {inv.payer_code})",
                    "preview_url": f"/api/v1/billing/invoices/{inv.id}/download-pdf/",
                    "download_url": f"/api/v1/billing/invoices/{inv.id}/download-pdf/",
                })

        elif entity_type == "payment":
            from apps.billing.models import Payment
            qs = Payment.objects.all()
            if q:
                qs = qs.filter(
                    Q(tracking_number__icontains=q)
                    | Q(payer_name__icontains=q)
                    | Q(payer_code__icontains=q)
                    | Q(description__icontains=q)
                )
            qs = qs.order_by("-payment_date", "-id")

            for pay in qs[:limit]:
                date_str = pay.payment_date.strftime("%Y/%m/%d") if pay.payment_date else ""
                results.append({
                    "entity_type": "payment",
                    "entity_id": str(pay.id),
                    "title": f"پرداخت {pay.payer_name}",
                    "code": f"پیگیری: {pay.tracking_number}" if pay.tracking_number else f"پرداخت #{pay.id}",
                    "date": date_str,
                    "amount": pay.amount,
                    "badge": "پرداخت مالی",
                    "status": "تأیید شده",
                    "subtitle": f"شرکت: {pay.payer_name} (کد {pay.payer_code})",
                    "tracking_number": pay.tracking_number,
                    "description": pay.description,
                })

        return Response(results)


class EntityPreviewView(APIView):
    """Return structured preview data or attachment information for a linked entity."""
    permission_classes = [IsAuthenticated, IsActiveCompanyUser]

    def get(self, request, entity_type, entity_id):
        if entity_type == "correspondence":
            from apps.office.models import Correspondence
            qs = Correspondence.objects.filter(id=entity_id)
            if request.user.company_id:
                qs = qs.filter(company_id=request.user.company_id)
            c = qs.first()
            if not c:
                raise Http404()
            attachments = []
            for att in c.attachments.all():
                attachments.append({
                    "id": att.id,
                    "name": att.original_name,
                    "content_type": att.content_type,
                    "size_bytes": att.size_bytes,
                    "download_url": f"/api/v1/office/correspondence/{c.id}/attachments/{att.id}/download/",
                })
            return Response({
                "entity_type": "correspondence",
                "id": c.id,
                "subject": c.subject,
                "registration_number": c.registration_number or f"پیش‌نویس #{c.id}",
                "letter_date": c.letter_date_jalali or (c.letter_date.strftime("%Y/%m/%d") if c.letter_date else ""),
                "body": c.body,
                "sender_name": c.sender_name or (c.sender_user.get_full_name() if c.sender_user else "سازمان"),
                "sender_organization": c.sender_organization,
                "priority": dict(Correspondence.PRIORITY_CHOICES).get(c.priority, c.priority),
                "confidentiality": dict(Correspondence.CONFIDENTIALITY_CHOICES).get(c.confidentiality, c.confidentiality),
                "status": dict(Correspondence.REGISTRATION_CHOICES).get(c.registration_status, c.registration_status),
                "attachments": attachments,
            })
        elif entity_type == "invoice":
            from apps.billing.models import Invoice, InvoiceItem
            inv = None
            if str(entity_id).isdigit():
                inv = Invoice.objects.filter(id=int(entity_id)).first()
            if not inv:
                inv = Invoice.objects.filter(letter_number=str(entity_id)).first()
            if not inv:
                raise Http404()

            items = []
            for it in InvoiceItem.objects.filter(letter_number=inv.letter_number).order_by("id"):
                items.append({
                    "id": it.id,
                    "service_type": it.service_type,
                    "passenger_name": it.passenger_name,
                    "destination": it.destination,
                    "hotel_name": it.hotel_name,
                    "ticket_number": it.ticket_number,
                    "room_type": it.room_type,
                    "contract_number": it.contract_number,
                    "guest_count": it.guest_count,
                    "item_date": it.item_date,
                    "description": it.description,
                    "debt_amount": it.debt_amount,
                    "credit_amount": it.credit_amount,
                    "amount": it.amount,
                })

            return Response({
                "entity_type": "invoice",
                "id": inv.id,
                "letter_number": inv.letter_number,
                "payer": inv.payer,
                "payer_code": inv.payer_code,
                "invoice_type": inv.invoice_type,
                "amount": inv.amount,
                "issue_date": inv.issue_date.strftime("%Y/%m/%d") if inv.issue_date else "",
                "period_range": inv.period_range or "",
                "description": inv.description,
                "items": items,
                "items_count": len(items),
                "pdf_url": f"/api/v1/billing/invoices/{inv.id}/download-pdf/",
                "letter_url": f"/api/v1/billing/invoices/{inv.id}/download-letter/",
            })
        elif entity_type == "payment":
            from apps.billing.models import Payment
            p = None
            if str(entity_id).isdigit():
                p = Payment.objects.filter(id=int(entity_id)).first()
            if not p:
                p = Payment.objects.filter(tracking_number=str(entity_id)).first()
            if not p:
                raise Http404()
            return Response({
                "entity_type": "payment",
                "id": p.id,
                "payer_name": p.payer_name,
                "payer_code": p.payer_code,
                "amount": p.amount,
                "payment_date": p.payment_date.strftime("%Y/%m/%d") if p.payment_date else "",
                "tracking_number": p.tracking_number,
                "description": p.description,
            })
        raise Http404()
