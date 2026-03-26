"""Daily Popup system — admin writes messages, collaborators see them on first login of the day."""
import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from ..database import get_db
from ..models import DailyPopup, Content, StatusEnum
from ..schemas import DailyPopupCreate, DailyPopupUpdate, DailyPopupResponse
from ..auth import get_current_user, require_admin, CurrentUser

router = APIRouter(prefix="/api/popups", tags=["popups"])


def _tasks_for_user(db: Session, user_id: str, start: datetime, end: datetime):
    """Get active tasks assigned to user (or pair) with deadline in [start, end]."""
    active_statuses = [StatusEnum.DA_ASSEGNARE, StatusEnum.IN_LAVORAZIONE, StatusEnum.IN_REVISIONE]
    q = db.query(Content).filter(
        Content.status.in_(active_statuses),
        Content.deadline.isnot(None),
        Content.deadline >= start,
        Content.deadline < end,
    )
    # Match direct assignment OR pair assignments containing this user
    results = q.all()
    matched = []
    for c in results:
        assignee = c.assigned_to.value if hasattr(c.assigned_to, 'value') else str(c.assigned_to or '')
        if assignee == user_id or user_id in assignee.split('+'):
            matched.append({
                "id": c.id,
                "title": c.title,
                "brand": c.brand.value if hasattr(c.brand, 'value') else str(c.brand),
                "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                "deadline": c.deadline.isoformat() if c.deadline else None,
            })
    return matched


# ── Admin endpoints ──

@router.get("/admin/{target_user}", response_model=list[DailyPopupResponse])
def list_popups_for_user(
    target_user: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    """List all popups for a given user (admin only), newest first."""
    if target_user not in ("federico", "marzia"):
        raise HTTPException(400, "Utente non valido")
    return (
        db.query(DailyPopup)
        .filter(DailyPopup.target_user == target_user)
        .order_by(DailyPopup.target_date.desc())
        .limit(100)
        .all()
    )


@router.post("/admin", response_model=DailyPopupResponse, status_code=201)
def create_popup(
    data: DailyPopupCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    """Create or update a popup for a given user+date (admin only).
    If a popup already exists for that user+date, updates the message.
    """
    if data.target_user not in ("federico", "marzia"):
        raise HTTPException(400, "Utente non valido")

    target_date = datetime.strptime(data.target_date, "%Y-%m-%d")

    # Upsert: check if popup exists for this user+date
    existing = db.query(DailyPopup).filter(
        DailyPopup.target_user == data.target_user,
        func.date(DailyPopup.target_date) == target_date.date(),
    ).first()

    if existing:
        existing.message = data.message
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    popup = DailyPopup(
        target_user=data.target_user,
        target_date=target_date,
        message=data.message,
    )
    db.add(popup)
    db.commit()
    db.refresh(popup)
    return popup


@router.patch("/admin/{popup_id}", response_model=DailyPopupResponse)
def update_popup(
    popup_id: int,
    data: DailyPopupUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    """Update a popup message (admin only)."""
    popup = db.query(DailyPopup).filter(DailyPopup.id == popup_id).first()
    if not popup:
        raise HTTPException(404, "Popup non trovato")
    if data.message is not None:
        popup.message = data.message
    db.commit()
    db.refresh(popup)
    return popup


@router.delete("/admin/{popup_id}", status_code=204)
def delete_popup(
    popup_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    popup = db.query(DailyPopup).filter(DailyPopup.id == popup_id).first()
    if not popup:
        raise HTTPException(404, "Popup non trovato")
    db.delete(popup)
    db.commit()


# ── Collaborator endpoint — get today's popup ──

@router.get("/my-daily")
def get_my_daily_popup(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Get today's popup for the logged-in collaborator.
    Returns the popup with tasks if unread, or null if already read today.
    Also populates task snapshots on first read.
    """
    user_id = user.user_id  # "federico" or "marzia"
    if user_id not in ("federico", "marzia"):
        return None

    today = datetime.now(timezone.utc).date()

    # Find popup for today (or create an auto one if admin set a message)
    popup = db.query(DailyPopup).filter(
        DailyPopup.target_user == user_id,
        func.date(DailyPopup.target_date) == today,
    ).first()

    # If no admin message exists for today, auto-generate a popup with just tasks
    if not popup:
        popup = DailyPopup(
            target_user=user_id,
            target_date=datetime.combine(today, datetime.min.time()),
            message=None,
        )
        db.add(popup)
        db.commit()
        db.refresh(popup)

    # Already read today — don't show again
    if popup.read_at is not None:
        return None

    # Populate task snapshots
    today_start = datetime.combine(today, datetime.min.time())
    today_end = today_start + timedelta(days=1)
    # Week: from today to end of week (Sunday)
    days_until_sunday = 6 - today.weekday()  # weekday 0=Mon
    week_end = today_start + timedelta(days=days_until_sunday + 1)

    tasks_today = _tasks_for_user(db, user_id, today_start, today_end)
    tasks_week = _tasks_for_user(db, user_id, today_start, week_end)

    popup.tasks_today_json = json.dumps(tasks_today, ensure_ascii=False)
    popup.tasks_week_json = json.dumps(tasks_week, ensure_ascii=False)
    db.commit()

    return {
        "id": popup.id,
        "target_user": popup.target_user,
        "target_date": popup.target_date.isoformat(),
        "message": popup.message,
        "tasks_today": tasks_today,
        "tasks_week": tasks_week,
        "read_at": None,
    }


@router.post("/my-daily/{popup_id}/read")
def mark_popup_read(
    popup_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Mark a popup as read."""
    popup = db.query(DailyPopup).filter(DailyPopup.id == popup_id).first()
    if not popup:
        raise HTTPException(404, "Popup non trovato")
    if popup.target_user != user.user_id:
        raise HTTPException(403, "Non autorizzato")
    popup.read_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
