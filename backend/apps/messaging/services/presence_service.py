import json
from typing import List, Dict, Optional
from django.conf import settings
from django.utils import timezone

try:
    import redis
    redis_client = redis.Redis.from_url(
        getattr(settings, "REDIS_URL", "redis://localhost:6379/0"),
        decode_responses=True,
    )
except Exception:
    redis_client = None


def _presence_key(company_id: int, user_id: int) -> str:
    return f"orbit:presence:{company_id}:{user_id}"


def _typing_key(company_id: int, conversation_id: str, user_id: int) -> str:
    return f"orbit:typing:{company_id}:{conversation_id}:{user_id}"


def update_user_presence(company_id: int, user_id: int, status: str = "online"):
    """Update ephemeral presence in Redis with TTL per spec §4.11 and persist last_seen_at."""
    from apps.accounts.models import User
    now = timezone.now()
    try:
        User.objects.filter(id=user_id).update(last_seen_at=now)
    except Exception:
        pass

    if not redis_client:
        return
    ttl = getattr(settings, "NEXIVO_MESSAGING_PRESENCE_TTL_SECONDS", 90)
    key = _presence_key(company_id, user_id)
    data = {
        "status": status,
        "last_seen": now.isoformat(),
    }
    try:
        redis_client.set(key, json.dumps(data), ex=ttl)
    except Exception:
        pass


def get_users_presence(company_id: int, user_ids: List[int]) -> Dict[int, str]:
    """Retrieve presence status ('online', 'away', 'offline') for a batch of users."""
    result = {uid: "offline" for uid in user_ids}
    if not redis_client or not user_ids:
        return result

    keys = [_presence_key(company_id, uid) for uid in user_ids]
    try:
        values = redis_client.mget(keys)
        for uid, val in zip(user_ids, values):
            if val:
                parsed = json.loads(val)
                result[uid] = parsed.get("status", "online")
    except Exception:
        pass

    return result


def set_user_typing(company_id: int, conversation_id: str, user_id: int, is_typing: bool):
    """Set or clear typing indicator with TTL per spec §4.11."""
    if not redis_client:
        return
    ttl = getattr(settings, "NEXIVO_MESSAGING_TYPING_TTL_SECONDS", 8)
    key = _typing_key(company_id, conversation_id, user_id)
    try:
        if is_typing:
            redis_client.set(key, "1", ex=ttl)
        else:
            redis_client.delete(key)
    except Exception:
        pass


def get_typing_users(company_id: int, conversation_id: str) -> List[int]:
    """Return user IDs currently typing in a conversation."""
    if not redis_client:
        return []
    pattern = f"orbit:typing:{company_id}:{conversation_id}:*"
    try:
        keys = redis_client.keys(pattern)
        uids = []
        for k in keys:
            uids.append(int(k.split(":")[-1]))
        return uids
    except Exception:
        return []
