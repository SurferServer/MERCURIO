import csv
import io
import os
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..database import get_db
from ..models import Content, Activity, ContentFile, ScriptBrief, MarketingNotification, StatusEnum, BrandEnum, ContentTypeEnum, ChannelEnum, SourceEnum, AssigneeEnum
from ..services.drive_service import upload_script_text_to_drive, delete_from_drive
from ..schemas import ContentCreate, ContentUpdate, ContentResponse, StatsResponse, BrandSummary, ActivityResponse
from ..auth import get_current_user, require_admin, require_editor, require_any, CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contents", tags=["contents"])
limiter = Limiter(key_func=get_remote_address)

BRAND_LABELS = {
    "guida-e-vai": "Guida e Vai",
    "quiz-patente": "Quiz Patente",
    "rinnovala": "Rinnovala",
}

# Valid enum values for input validation
VALID_BRANDS = {e.value for e in BrandEnum}
VALID_TYPES = {e.value for e in ContentTypeEnum}
VALID_CHANNELS = {e.value for e in ChannelEnum}
VALID_SOURCES = {e.value for e in SourceEnum}
VALID_STATUSES = {e.value for e in StatusEnum}
VALID_ASSIGNEES = {e.value for e in AssigneeEnum}


def _validate_enum(value: Optional[str], valid: set, name: str):
    """Validate that a string value is in a known enum set."""
    if value is not None and value not in valid:
        raise HTTPException(
            status_code=422,
            detail=f"Valore non valido per {name}: '{value}'"
        )


@router.get("/", response_model=list[ContentResponse])
def list_contents(
    status: Optional[str] = None,
    brand: Optional[str] = None,
    content_type: Optional[str] = None,
    channel: Optional[str] = None,
    source: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    archived: bool = False,
    # Calendar month filter — returns ALL items matching the given month (ignores limit)
    year: Optional[int] = None,
    month: Optional[int] = Query(default=None, ge=1, le=12),
    date_field: Optional[str] = Query(default="deadline", pattern="^(deadline|created|completed|archived)$"),
    limit: int = Query(default=200, le=5000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    # Validate filter params against enums
    _validate_enum(status, VALID_STATUSES, "status")
    _validate_enum(brand, VALID_BRANDS, "brand")
    _validate_enum(content_type, VALID_TYPES, "content_type")
    _validate_enum(channel, VALID_CHANNELS, "channel")
    _validate_enum(source, VALID_SOURCES, "source")
    _validate_enum(assigned_to, VALID_ASSIGNEES, "assigned_to")

    q = db.query(Content)

    # Calendar month queries bypass status filters — show everything in that month
    is_calendar = year is not None and month is not None

    # Marketing users can only see completed/archived content
    if user.is_marketing and not is_calendar:
        q = q.filter(Content.status.in_([StatusEnum.COMPLETATO, StatusEnum.ARCHIVIATO]))
    elif not is_calendar:
        if archived:
            q = q.filter(Content.status.in_([StatusEnum.COMPLETATO, StatusEnum.ARCHIVIATO]))
        else:
            q = q.filter(Content.status != StatusEnum.ARCHIVIATO)

    if status:
        q = q.filter(Content.status == status)
    if brand:
        q = q.filter(Content.brand == brand)
    if content_type:
        q = q.filter(Content.content_type == content_type)
    if channel:
        q = q.filter(Content.channel == channel)
    if source:
        q = q.filter(Content.source == source)
    if assigned_to:
        q = q.filter(Content.assigned_to == assigned_to)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(
            (Content.title.ilike(term)) | (Content.notes.ilike(term))
        )

    # Month filter for calendar view — returns all matching items (no limit)
    if year is not None and month is not None:
        from sqlalchemy import extract, or_, and_
        # Pick which date column(s) to filter on
        if date_field == "completed":
            # Match on completed_at OR created_at (fallback)
            q = q.filter(
                or_(
                    and_(
                        Content.completed_at.isnot(None),
                        extract('year', Content.completed_at) == year,
                        extract('month', Content.completed_at) == month,
                    ),
                    and_(
                        Content.completed_at.is_(None),
                        extract('year', Content.created_at) == year,
                        extract('month', Content.created_at) == month,
                    ),
                )
            )
        elif date_field == "deadline":
            # Match on deadline OR created_at (fallback)
            q = q.filter(
                or_(
                    and_(
                        Content.deadline.isnot(None),
                        extract('year', Content.deadline) == year,
                        extract('month', Content.deadline) == month,
                    ),
                    and_(
                        Content.deadline.is_(None),
                        extract('year', Content.created_at) == year,
                        extract('month', Content.created_at) == month,
                    ),
                )
            )
        elif date_field == "archived":
            q = q.filter(
                Content.archived_at.isnot(None),
                extract('year', Content.archived_at) == year,
                extract('month', Content.archived_at) == month,
            )
        else:  # created
            q = q.filter(
                extract('year', Content.created_at) == year,
                extract('month', Content.created_at) == month,
            )
        # No limit for month queries — return everything in that month
        return q.order_by(Content.created_at.desc()).all()

    return q.order_by(Content.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Compute stats using SQL COUNT — no full-table Python scan."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Single query: count by status
    status_counts = (
        db.query(Content.status, func.count())
        .group_by(Content.status)
        .all()
    )
    sc = {s.value if hasattr(s, 'value') else s: c for s, c in status_counts}

    da_assegnare = sc.get("da-assegnare", 0)
    in_lavorazione = sc.get("in-lavorazione", 0)
    in_revisione = sc.get("in-revisione", 0)
    completato = sc.get("completato", 0)
    archiviato = sc.get("archiviato", 0)
    totale_attivi = da_assegnare + in_lavorazione + in_revisione + completato

    working_statuses = [StatusEnum.IN_LAVORAZIONE, StatusEnum.IN_REVISIONE]

    federico_attivi = db.query(func.count()).filter(
        Content.assigned_to == AssigneeEnum.FEDERICO,
        Content.status.in_(working_statuses),
    ).scalar()

    marzia_attivi = db.query(func.count()).filter(
        Content.assigned_to == AssigneeEnum.MARZIA,
        Content.status.in_(working_statuses),
    ).scalar()

    da_marketing = db.query(func.count()).filter(
        Content.source == SourceEnum.MARKETING,
        Content.status != StatusEnum.ARCHIVIATO,
    ).scalar()

    scaduti = db.query(func.count()).filter(
        Content.deadline < now,
        Content.status.notin_([StatusEnum.COMPLETATO, StatusEnum.ARCHIVIATO]),
    ).scalar()

    return StatsResponse(
        da_assegnare=da_assegnare,
        in_lavorazione=in_lavorazione,
        in_revisione=in_revisione,
        completato=completato,
        archiviato=archiviato,
        totale_attivi=totale_attivi,
        federico_attivi=federico_attivi,
        marzia_attivi=marzia_attivi,
        da_marketing=da_marketing,
        scaduti=scaduti,
    )


@router.get("/archive-summary", response_model=list[BrandSummary])
def get_archive_summary(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Compute archive summary using SQL aggregation — no full-table Python scan."""
    archived_filter = Content.status.in_([StatusEnum.COMPLETATO, StatusEnum.ARCHIVIATO])

    rows = (
        db.query(
            Content.brand,
            Content.content_type,
            Content.channel,
            func.count().label("cnt"),
        )
        .filter(archived_filter)
        .group_by(Content.brand, Content.content_type, Content.channel)
        .all()
    )

    # Build summaries from aggregated rows
    brand_data = {}
    for brand_key in BRAND_LABELS:
        brand_data[brand_key] = {"totale": 0, "video": 0, "grafica": 0, "sviluppo": 0, "organico": 0, "adv": 0}

    for brand, ctype, channel, cnt in rows:
        bk = brand.value if hasattr(brand, 'value') else brand
        if bk not in brand_data:
            continue
        brand_data[bk]["totale"] += cnt
        ct = ctype.value if hasattr(ctype, 'value') else ctype
        if ct in brand_data[bk]:
            brand_data[bk][ct] += cnt
        ch = channel.value if hasattr(channel, 'value') else channel
        if ch in brand_data[bk]:
            brand_data[bk][ch] += cnt

    return [
        BrandSummary(brand=bk, brand_label=BRAND_LABELS[bk], **data)
        for bk, data in brand_data.items()
    ]


@router.get("/export/excel")
def export_excel(
    brand: Optional[str] = None,
    content_type: Optional[str] = None,
    channel: Optional[str] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    from fastapi.responses import StreamingResponse
    from openpyxl import Workbook
    from io import BytesIO

    # Validate params
    _validate_enum(brand, VALID_BRANDS, "brand")
    _validate_enum(content_type, VALID_TYPES, "content_type")
    _validate_enum(channel, VALID_CHANNELS, "channel")
    _validate_enum(source, VALID_SOURCES, "source")

    q = db.query(Content).filter(
        Content.status.in_([StatusEnum.COMPLETATO, StatusEnum.ARCHIVIATO])
    )
    if brand:
        q = q.filter(Content.brand == brand)
    if content_type:
        q = q.filter(Content.content_type == content_type)
    if channel:
        q = q.filter(Content.channel == channel)
    if source:
        q = q.filter(Content.source == source)

    items = q.order_by(Content.completed_at.desc()).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Archivio Contenuti"
    headers = ["ID", "Titolo", "Brand", "Tipo", "Canale", "Origine", "Assegnato a", "Stato", "Scadenza", "Completato", "Link Drive"]
    ws.append(headers)

    for item in items:
        ws.append([
            item.id,
            item.title,
            BRAND_LABELS.get(item.brand.value if item.brand else "", ""),
            {"video": "Video", "grafica": "Grafica", "sviluppo": "Sviluppo"}.get(item.content_type.value if item.content_type else "", ""),
            "Organico" if item.channel and item.channel.value == "organico" else "ADV",
            "Marketing" if item.source and item.source.value == "marketing" else "Interno",
            (item.assigned_to.value.capitalize() if item.assigned_to else ""),
            item.status.value if item.status else "",
            item.deadline.strftime("%d/%m/%Y") if item.deadline else "",
            item.completed_at.strftime("%d/%m/%Y") if item.completed_at else "",
            item.drive_link or "",
        ])

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=archivio_contenuti.xlsx"},
    )


@router.get("/{content_id}", response_model=ContentResponse)
def get_content(
    content_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    # Marketing can only access completed/archived items
    if user.is_marketing and content.status not in (StatusEnum.COMPLETATO, StatusEnum.ARCHIVIATO):
        raise HTTPException(status_code=403, detail="Non hai i permessi per visualizzare questo contenuto")
    return content


@router.post("/", response_model=ContentResponse, status_code=201)
def create_content(
    data: ContentCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_editor),
):
    """Admin and collaborators can create content."""
    content = Content(
        title=data.title,
        brand=data.brand,
        content_type=data.content_type,
        channel=data.channel,
        source=data.source,
        assigned_to=data.assigned_to,
        script=data.script,
        notes=data.notes,
        deadline=data.deadline,
        script_brief_id=data.script_brief_id,
        status=StatusEnum.IN_LAVORAZIONE if data.assigned_to else StatusEnum.DA_ASSEGNARE,
    )
    db.add(content)
    db.commit()
    db.refresh(content)

    # Mark script/brief as used
    if data.script_brief_id:
        sb = db.query(ScriptBrief).filter(ScriptBrief.id == data.script_brief_id).first()
        if sb:
            sb.is_used = True
            db.commit()

    activity = Activity(content_id=content.id, action=f"Creato da {user.name}")
    db.add(activity)
    if content.assigned_to:
        name = content.assigned_to.value.capitalize() if hasattr(content.assigned_to, 'value') else str(content.assigned_to).capitalize()
        db.add(Activity(content_id=content.id, action=f"Assegnato a {name}"))
    db.commit()

    return content


MONTH_MAP_IT = {
    "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
    "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
    "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
}


def _parse_date_from_folder(cartella: str, percorso: str) -> "datetime | None":
    """Try to extract a real date from folder name or path structure.

    Priority:
    1. Folder name starts with DD_MM_YY (e.g. '25_3_25_ADV_SALVO' → 2025-03-25)
    2. Path contains /YYYY/MONTH_IT/ + folder starts with 'N DOW -' (e.g. /2024/NOVEMBRE/5 MAR -)
    3. None (caller falls back to Data caricamento)
    """
    import re

    # 1. Folder name date prefix: DD_MM_YY or DD_MM_YYYY
    m = re.match(r'^(\d{1,2})_(\d{1,2})_(\d{2,4})', cartella)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year += 2000
        try:
            return datetime(year, month, day)
        except ValueError:
            pass

    # 2. Path: .../YYYY/MONTH_IT/... + optional day from folder "5 MAR - ..."
    m2 = re.search(r'/(\d{4})/(GENNAIO|FEBBRAIO|MARZO|APRILE|MAGGIO|GIUGNO|LUGLIO|AGOSTO|SETTEMBRE|OTTOBRE|NOVEMBRE|DICEMBRE)/', percorso, re.I)
    if m2:
        year = int(m2.group(1))
        month = MONTH_MAP_IT.get(m2.group(2).lower(), 1)
        # Try to get day from folder name: "5 MAR - title" or "12 GIO - title"
        dm = re.match(r'^(\d{1,2})\s', cartella)
        day = int(dm.group(1)) if dm else 1
        try:
            return datetime(year, month, day)
        except ValueError:
            return datetime(year, month, 1)

    return None


@router.post("/import-csv")
async def import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    """Import archived content from CSV files (admin only).
    Re-import safe: updates dates on existing records (matched by drive_link).
    Supports two CSV formats:
    - Video CSV: Cartella, Nome Video, Link, Data caricamento, Percorso cartella, Link cartella
    - Statiche CSV: Cartella, File, Link, Data creazione
    """
    raw = await file.read()
    text = raw.decode("utf-8-sig")  # handle BOM
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []

    is_video_csv = "Data caricamento" in headers
    is_static_csv = "Data creazione" in headers

    if not is_video_csv and not is_static_csv:
        raise HTTPException(400, "CSV non riconosciuto. Serve colonna 'Data caricamento' o 'Data creazione'.")

    created = 0
    updated = 0
    skipped = 0

    for row in reader:
        # Extract drive link — skip rows without it
        drive_link = (row.get("Link") or "").strip()
        if not drive_link or not drive_link.startswith("http"):
            skipped += 1
            continue

        title = (row.get("Cartella") or row.get("Nome Video") or "Senza titolo").strip()
        file_name = (row.get("Nome Video") or row.get("File") or "").strip()

        # ── Date resolution ──
        date_val = None

        if is_video_csv:
            # 1st priority: parse from folder name / path structure
            cartella = (row.get("Cartella") or "").strip()
            percorso = row.get("Percorso cartella") or ""
            date_val = _parse_date_from_folder(cartella, percorso)

            # 2nd priority: Data caricamento (Drive upload timestamp)
            if date_val is None:
                raw_date = (row.get("Data caricamento") or "").strip()
                if raw_date:
                    try:
                        date_val = datetime.strptime(raw_date, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        pass
        else:
            raw_date = (row.get("Data creazione") or "").strip()
            if raw_date:
                try:
                    date_val = datetime.strptime(raw_date, "%d/%m/%Y %H.%M.%S")
                except ValueError:
                    pass

        # ── Content type ──
        ext = os.path.splitext(file_name)[1].lower() if file_name else ""
        if ext in (".mp4", ".mov", ".avi", ".mkv", ".webm"):
            content_type = ContentTypeEnum.VIDEO
        else:
            content_type = ContentTypeEnum.GRAFICA

        # ── Brand + channel from path ──
        folder_path = (row.get("Percorso cartella") or "").lower()

        if "quiz patente" in folder_path or "quiz_patente" in title.lower():
            brand = BrandEnum.QUIZ_PATENTE
        elif "rinnovala" in folder_path or "rinnovala" in title.lower():
            brand = BrandEnum.RINNOVALA
        elif "guida e vai" in folder_path or "guida_e_vai" in title.lower() or "guida sicura" in folder_path:
            brand = BrandEnum.GUIDA_E_VAI
        else:
            brand = BrandEnum.QUIZ_PATENTE

        if "/adv/" in folder_path or "_adv_" in title.lower() or "adv" in title.lower().split("_")[:2]:
            channel = ChannelEnum.ADV
        else:
            channel = ChannelEnum.ORGANICO

        # ── Check existing record ──
        existing = db.query(Content).filter(Content.drive_link == drive_link).first()

        if existing:
            # Re-import: update dates only
            if date_val:
                existing.deadline = date_val
                existing.created_at = date_val
                existing.completed_at = date_val
            updated += 1
        else:
            content = Content(
                title=title,
                brand=brand,
                content_type=content_type,
                channel=channel,
                source=SourceEnum.INTERNO,
                status=StatusEnum.ARCHIVIATO,
                file_name=file_name or None,
                drive_link=drive_link,
                deadline=date_val,
                created_at=date_val or datetime.now(timezone.utc),
                completed_at=date_val,
                notes=f"Importato da CSV: {file.filename}",
            )
            db.add(content)
            created += 1

        if (created + updated) % 200 == 0:
            db.commit()

    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped, "total_rows": created + updated + skipped}


@router.patch("/{content_id}", response_model=ContentResponse)
def update_content(
    content_id: int,
    data: ContentUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_editor),
):
    """Admin and collaborators can update. Additional checks inside."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    # Collaborators can change status (limited), reassign, and edit some fields
    if user.is_collaborator:
        allowed_status_transitions = {
            "in-lavorazione": ["in-revisione"],
            "in-revisione": ["in-lavorazione"],
            "archiviato": ["in-lavorazione"],
        }
        if data.status:
            current = content.status.value if content.status else None
            allowed = allowed_status_transitions.get(current, [])
            if data.status not in allowed:
                raise HTTPException(
                    status_code=403,
                    detail=f"Non puoi spostare da '{current}' a '{data.status}'"
                )
        # Collaborators can edit title, script, notes, deadline, drive_link, and assigned_to
        if not user.is_admin:
            non_status_fields = {k: v for k, v in data.model_dump(exclude_unset=True).items() if k not in ('title', 'status', 'script', 'notes', 'deadline', 'drive_link', 'assigned_to')}
            if non_status_fields:
                raise HTTPException(status_code=403, detail="Non hai i permessi per modificare questi campi")

    # Validate enum fields
    if data.status:
        _validate_enum(data.status, VALID_STATUSES, "status")
    if data.brand:
        _validate_enum(data.brand, VALID_BRANDS, "brand")
    if data.content_type:
        _validate_enum(data.content_type, VALID_TYPES, "content_type")
    if data.channel:
        _validate_enum(data.channel, VALID_CHANNELS, "channel")
    if data.source:
        _validate_enum(data.source, VALID_SOURCES, "source")
    if data.assigned_to:
        _validate_enum(data.assigned_to, VALID_ASSIGNEES, "assigned_to")

    old_status = content.status.value if content.status else None
    old_assignee = content.assigned_to.value if content.assigned_to else None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(content, field, value)

    if data.status:
        if data.status == "completato":
            content.completed_at = data.completed_at or datetime.now(timezone.utc)
        elif data.status == "archiviato":
            content.archived_at = data.archived_at or datetime.now(timezone.utc)
            if not content.completed_at:
                content.completed_at = data.completed_at or datetime.now(timezone.utc)

    if data.assigned_to and content.status == StatusEnum.DA_ASSEGNARE:
        content.status = StatusEnum.IN_LAVORAZIONE

    content.updated_at = datetime.now(timezone.utc)

    # Archive script text to Drive when content is archived
    if data.status == "archiviato" and content.script:
        try:
            brand_val = content.brand.value if content.brand else "interno"
            type_val = content.content_type.value if content.content_type else "video"
            channel_val = content.channel.value if content.channel else "organico"
            upload_script_text_to_drive(
                script_text=content.script,
                title=content.title,
                brand=brand_val,
                content_type=type_val,
                channel=channel_val,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Script text archive failed: {e}")

    if data.status and data.status != old_status:
        status_labels = {
            "da-assegnare": "Da Assegnare",
            "in-lavorazione": "In Lavorazione",
            "in-revisione": "In Revisione",
            "completato": "Completato",
            "archiviato": "Archiviato",
        }
        db.add(Activity(content_id=content.id, action=f"Stato → {status_labels.get(data.status, data.status)} ({user.name})"))

        # Create marketing notification when a marketing-sourced task is completed
        if data.status == "completato" and content.source == SourceEnum.MARKETING:
            existing = db.query(MarketingNotification).filter(
                MarketingNotification.content_id == content.id
            ).first()
            if not existing:
                db.add(MarketingNotification(content_id=content.id))
    new_assignee = data.assigned_to if data.assigned_to is not None else None
    if new_assignee and new_assignee != old_assignee:
        db.add(Activity(content_id=content.id, action=f"Assegnato a {new_assignee.capitalize()} ({user.name})"))
        # Auto-note on reassignment
        reassign_note = f"[{datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')}] Riassegnato da {user.name}: {old_assignee or 'nessuno'} → {new_assignee}"
        if content.notes:
            content.notes = content.notes.rstrip() + "\n" + reassign_note
        else:
            content.notes = reassign_note

    db.commit()
    db.refresh(content)
    return content


@router.delete("/{content_id}", status_code=204)
def delete_content(
    content_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_editor),
):
    """Admin can always delete. Collaborators can delete only before completion."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    # Collaborators cannot delete completed or archived tasks
    if not user.is_admin and content.status in ("completato", "archiviato"):
        raise HTTPException(
            status_code=403,
            detail="Non puoi eliminare un contenuto già completato o archiviato",
        )

    # Clean up files from Google Drive before deleting the DB record
    file_versions = db.query(ContentFile).filter(ContentFile.content_id == content_id).all()
    drive_ids_to_delete = {cf.drive_file_id for cf in file_versions if cf.drive_file_id}
    if content.drive_file_id:
        drive_ids_to_delete.add(content.drive_file_id)
    for drive_id in drive_ids_to_delete:
        try:
            delete_from_drive(drive_id)
        except Exception as e:
            logger.warning(f"Failed to delete Drive file {drive_id}: {e}")

    # Delete file version records
    db.query(ContentFile).filter(ContentFile.content_id == content_id).delete()

    db.delete(content)
    db.commit()


@router.get("/{content_id}/activities", response_model=list[ActivityResponse])
def get_activities(
    content_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return db.query(Activity).filter(Activity.content_id == content_id).order_by(Activity.created_at.asc()).all()
