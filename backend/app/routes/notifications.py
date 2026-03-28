"""
Marketing notification endpoints.

When a marketing-sourced content reaches 'completato',
a MarketingNotification row is created. The marketing user
sees an unread count badge and can view/dismiss notifications.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import MarketingNotification, Content, SourceEnum, StatusEnum
from ..auth import get_current_user, require_role, CurrentUser

# Only admin and marketing can manage notifications
_require_admin_or_marketing = require_role("admin", "marketing")

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/marketing/count")
def get_unread_count(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Return unread marketing notification count. Available to all authenticated users (badge)."""
    count = (
        db.query(func.count(MarketingNotification.id))
        .filter(MarketingNotification.read_at.is_(None))
        .scalar()
    )
    return {"unread_count": count}


@router.get("/marketing")
def list_notifications(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(_require_admin_or_marketing),
):
    """List marketing notifications with content details, newest first. Admin and marketing only."""
    rows = (
        db.query(MarketingNotification, Content)
        .join(Content, Content.id == MarketingNotification.content_id)
        .order_by(MarketingNotification.created_at.desc())
        .limit(100)
        .all()
    )
    result = []
    for notif, content in rows:
        result.append({
            "id": notif.id,
            "content_id": content.id,
            "title": content.title,
            "brand": content.brand.value if content.brand else None,
            "content_type": content.content_type.value if content.content_type else None,
            "channel": content.channel.value if content.channel else None,
            "status": content.status.value if content.status else None,
            "completed_at": content.completed_at.isoformat() if content.completed_at else None,
            "drive_link": content.drive_link,
            "read_at": notif.read_at.isoformat() if notif.read_at else None,
            "created_at": notif.created_at.isoformat() if notif.created_at else None,
        })
    return result


@router.post("/marketing/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(_require_admin_or_marketing),
):
    """Mark all unread marketing notifications as read. Admin and marketing only."""
    now = datetime.now(timezone.utc)
    updated = (
        db.query(MarketingNotification)
        .filter(MarketingNotification.read_at.is_(None))
        .update({"read_at": now})
    )
    db.commit()
    return {"marked_read": updated}


@router.post("/marketing/{notif_id}/read")
def mark_one_read(
    notif_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(_require_admin_or_marketing),
):
    """Mark a single notification as read. Admin and marketing only."""
    notif = db.query(MarketingNotification).filter(MarketingNotification.id == notif_id).first()
    if notif and not notif.read_at:
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
    return {"ok": True}
