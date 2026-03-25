from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ScriptBrief, Content, Activity, BriefTypeEnum, BrandEnum, AssigneeEnum, StatusEnum
from ..schemas import ScriptBriefCreate, ScriptBriefBatchCreate, ScriptBriefUpdate, ScriptBriefResponse
from ..auth import get_current_user, require_admin, require_any, CurrentUser

router = APIRouter(prefix="/api/script-briefs", tags=["script-briefs"])

VALID_BRIEF_TYPES = {e.value for e in BriefTypeEnum}
VALID_BRANDS = {e.value for e in BrandEnum}
VALID_ASSIGNEES = {e.value for e in AssigneeEnum}


@router.get("/", response_model=list[ScriptBriefResponse])
def list_script_briefs(
    brief_type: Optional[str] = None,
    brand: Optional[str] = None,
    assigned_to: Optional[str] = None,
    available: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    q = db.query(ScriptBrief)
    if brief_type:
        if brief_type not in VALID_BRIEF_TYPES:
            raise HTTPException(422, f"Tipo non valido: '{brief_type}'")
        q = q.filter(ScriptBrief.brief_type == brief_type)
    if brand:
        if brand not in VALID_BRANDS:
            raise HTTPException(422, f"Brand non valido: '{brand}'")
        q = q.filter(ScriptBrief.brand == brand)
    if assigned_to:
        if assigned_to not in VALID_ASSIGNEES:
            raise HTTPException(422, f"Assegnatario non valido: '{assigned_to}'")
        q = q.filter(ScriptBrief.assigned_to == assigned_to)
    if available is True:
        q = q.filter(ScriptBrief.is_used == False)
    return q.order_by(ScriptBrief.created_at.desc()).all()


@router.get("/{sb_id}", response_model=ScriptBriefResponse)
def get_script_brief(
    sb_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    sb = db.query(ScriptBrief).filter(ScriptBrief.id == sb_id).first()
    if not sb:
        raise HTTPException(404, "Script/Brief non trovato")
    return sb


@router.post("/", response_model=ScriptBriefResponse)
def create_script_brief(
    data: ScriptBriefCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_any),
):
    if data.brief_type not in VALID_BRIEF_TYPES:
        raise HTTPException(422, f"Tipo non valido: '{data.brief_type}'")
    if data.brand not in VALID_BRANDS:
        raise HTTPException(422, f"Brand non valido: '{data.brand}'")
    if data.assigned_to and data.assigned_to not in VALID_ASSIGNEES:
        raise HTTPException(422, f"Assegnatario non valido: '{data.assigned_to}'")

    # Marketing can create but not assign — force null
    assigned = data.assigned_to if user.is_admin else None

    sb = ScriptBrief(
        title=data.title,
        brief_type=data.brief_type,
        brand=data.brand,
        content=data.content,
        notes=data.notes,
        assigned_to=assigned,
    )
    db.add(sb)
    db.commit()
    db.refresh(sb)

    # Auto-create a Content task linked to this Script/Brief
    # Script → video, Brief → grafica
    # Always starts as DA_ASSEGNARE — assignment is a separate step from the Board
    content_type = "video" if data.brief_type == "script" else "grafica"
    content = Content(
        title=data.title,
        brand=data.brand,
        content_type=content_type,
        channel="organico",
        source="interno",
        assigned_to=None,
        script=data.content,
        notes=data.notes,
        script_brief_id=sb.id,
        status=StatusEnum.DA_ASSEGNARE,
    )
    db.add(content)
    db.commit()
    db.refresh(content)

    # Mark script/brief as used
    sb.is_used = True
    db.commit()

    # Log activity
    db.add(Activity(content_id=content.id, action=f"Creato automaticamente da {data.brief_type} \"{data.title}\" ({user.name})"))
    db.commit()

    return sb


@router.post("/batch", response_model=list[ScriptBriefResponse])
def create_script_briefs_batch(
    data: ScriptBriefBatchCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_any),
):
    """Create multiple script/briefs at once. Each generates its own Content task."""
    if data.brief_type not in VALID_BRIEF_TYPES:
        raise HTTPException(422, f"Tipo non valido: '{data.brief_type}'")
    if data.brand not in VALID_BRANDS:
        raise HTTPException(422, f"Brand non valido: '{data.brand}'")

    content_type = "video" if data.brief_type == "script" else "grafica"
    created = []

    for item in data.items:
        sb = ScriptBrief(
            title=item.title,
            brief_type=data.brief_type,
            brand=data.brand,
            content=item.content,
            notes=data.notes,
            assigned_to=None,  # batch creation never pre-assigns
        )
        db.add(sb)
        db.flush()  # get sb.id without committing

        content = Content(
            title=item.title,
            brand=data.brand,
            content_type=content_type,
            channel="organico",
            source="interno",
            assigned_to=None,
            script=item.content,
            notes=data.notes,
            script_brief_id=sb.id,
            status=StatusEnum.DA_ASSEGNARE,
        )
        db.add(content)
        db.flush()

        sb.is_used = True
        db.add(Activity(
            content_id=content.id,
            action=f"Creato automaticamente da {data.brief_type} \"{item.title}\" ({user.name}) [batch]",
        ))
        created.append(sb)

    db.commit()
    for sb in created:
        db.refresh(sb)

    return created


@router.patch("/{sb_id}", response_model=ScriptBriefResponse)
def update_script_brief(
    sb_id: int,
    data: ScriptBriefUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    sb = db.query(ScriptBrief).filter(ScriptBrief.id == sb_id).first()
    if not sb:
        raise HTTPException(404, "Script/Brief non trovato")

    update_data = data.model_dump(exclude_unset=True)
    if "assigned_to" in update_data and update_data["assigned_to"]:
        if update_data["assigned_to"] not in VALID_ASSIGNEES:
            raise HTTPException(422, f"Assegnatario non valido")

    for key, value in update_data.items():
        setattr(sb, key, value)
    db.commit()
    db.refresh(sb)
    return sb


@router.delete("/{sb_id}")
def delete_script_brief(
    sb_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    sb = db.query(ScriptBrief).filter(ScriptBrief.id == sb_id).first()
    if not sb:
        raise HTTPException(404, "Script/Brief non trovato")

    # Delete linked content (and its activities) if any
    linked_contents = db.query(Content).filter(Content.script_brief_id == sb.id).all()
    for content in linked_contents:
        db.query(Activity).filter(Activity.content_id == content.id).delete()
        db.delete(content)

    db.delete(sb)
    db.commit()
    return {"detail": "Eliminato"}
