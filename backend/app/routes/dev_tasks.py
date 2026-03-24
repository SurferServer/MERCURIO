"""
Dev Tasks routes — ONLY for Federico (and admin for viewing).
Federico can create, update, complete his development tasks.
Fulvio (admin) can view them too.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DevTask, DevTaskStatusEnum
from ..schemas import DevTaskCreate, DevTaskUpdate, DevTaskResponse
from ..auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/dev-tasks", tags=["dev-tasks"])


def _require_federico_or_admin(user: CurrentUser):
    """Only Federico and admin can access dev tasks."""
    if user.user_id not in ("federico", "fulvio"):
        raise HTTPException(status_code=403, detail="Non hai i permessi per questa sezione")


@router.get("/", response_model=list[DevTaskResponse])
def list_dev_tasks(
    status: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_federico_or_admin(user)
    q = db.query(DevTask)
    if status:
        q = q.filter(DevTask.status == status)
    return q.order_by(DevTask.created_at.desc()).all()


@router.post("/", response_model=DevTaskResponse, status_code=201)
def create_dev_task(
    data: DevTaskCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Only Federico can create dev tasks
    if user.user_id != "federico":
        raise HTTPException(status_code=403, detail="Solo Federico può creare task di sviluppo")
    task = DevTask(
        title=data.title,
        description=data.description,
        estimated_hours=data.estimated_hours,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=DevTaskResponse)
def update_dev_task(
    task_id: int,
    data: DevTaskUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.user_id != "federico":
        raise HTTPException(status_code=403, detail="Solo Federico può modificare i task di sviluppo")
    task = db.query(DevTask).filter(DevTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovato")

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.estimated_hours is not None:
        task.estimated_hours = data.estimated_hours
    if data.status is not None:
        task.status = data.status
        if data.status == DevTaskStatusEnum.COMPLETATO and not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)
        elif data.status == DevTaskStatusEnum.IN_CORSO:
            task.completed_at = None

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_dev_task(
    task_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.user_id != "federico":
        raise HTTPException(status_code=403, detail="Solo Federico può eliminare i task di sviluppo")
    task = db.query(DevTask).filter(DevTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovato")
    db.delete(task)
    db.commit()
    return None
