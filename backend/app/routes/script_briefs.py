from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ScriptBrief, Content, Activity, BriefTypeEnum, BrandEnum, AssigneeEnum, StatusEnum
from ..schemas import ScriptBriefCreate, ScriptBriefUpdate, ScriptBriefResponse
from ..auth import get_current_user, require_admin, CurrentUser

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
    user: CurrentUser = Depends(require_admin),
):
    if data.brief_type not in VALID_BRIEF_TYPES:
        raise HTTPException(422, f"Tipo non valido: '{data.brief_type}'")
    if data.brand not in VALID_BRANDS:
        raise HTTPException(422, f"Brand non valido: '{data.brand}'")
    if data.assigned_to and data.assigned_to not in VALID_ASSIGNEES:
        raise HTTPException(422, f"Assegnatario non valido: '{data.assigned_to}'")

    sb = ScriptBrief(
        title=data.title,
        brief_type=data.brief_type,
        brand=data.brand,
        content=data.content,
        notes=data.notes,
        assigned_to=data.assigned_to,
    )
    db.add(sb)
    db.commit()
    db.refresh(sb)

    # Auto-create a Content task linked to this Script/Brief
    # Script → video, Brief → grafica
    content_type = "video" if data.brief_type == "script" else "grafica"
    has_assignee = bool(data.assigned_to)
    content = Content(
        title=data.title,
        brand=data.brand,
        content_type=content_type,
        channel="organico",
        source="interno",
        assigned_to=data.assigned_to,
        script=data.content,
        notes=data.notes,
        script_brief_id=sb.id,
        status=StatusEnum.IN_LAVORAZIONE if has_assignee else StatusEnum.DA_ASSEGNARE,
    )
    db.add(content)
    db.commit()
    db.refresh(content)

    # Mark script/brief as used
    sb.is_used = True
    db.commit()

    # Log activity
    db.add(Activity(content_id=content.id, action=f"Creato automaticamente da {data.brief_type} \"{data.title}\" ({user.name})"))
    if has_assignee:
        db.add(Activity(content_id=content.id, action=f"Assegnato a {data.assigned_to.capitalize()}"))
    db.commit()

    return sb


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
    if sb.is_used:
        raise HTTPException(400, "Non puoi eliminare uno script/brief già assegnato a un contenuto")
    db.delete(sb)
    db.commit()
    return {"detail": "Eliminato"}
