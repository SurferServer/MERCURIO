"""
File handling routes — Google Drive is PRIMARY storage.

Upload flow:
  1. Read file bytes + validate
  2. Upload to Google Drive → get drive_file_id + webViewLink
  3. Generate thumbnail from bytes (temp file, then cleanup)
  4. Save metadata to DB (no local file path stored)

Download flow:
  1. Read drive_file_id from DB
  2. Stream file bytes from Drive API
  3. Return as response
"""

import os
import re
import logging
import mimetypes
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Content, ContentFile
from ..auth import get_current_user, require_editor, require_admin, CurrentUser
from ..services.thumbnail_service import generate_thumbnail_from_bytes, THUMB_DIR
from ..services.drive_service import (
    upload_to_drive,
    download_from_drive,
    is_configured as drive_is_configured,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/files", tags=["files"])

# Thumbnails still stored locally (small JPEGs, regenerable)
os.makedirs(THUMB_DIR, exist_ok=True)

# ── Security: file validation ────────────────────────────
MAX_FILE_SIZE_MB = int(os.getenv("MERCURIO_MAX_UPLOAD_MB", "500"))
MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

ALLOWED_EXTENSIONS = {
    # Video
    ".mp4", ".mov", ".avi", ".mkv", ".webm",
    # Images / Graphics
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff",
    # Design files
    ".psd", ".ai", ".eps", ".pdf",
    # Documents
    ".doc", ".docx", ".xls", ".xlsx", ".pptx",
    # Archives
    ".zip", ".rar",
}

SAFE_FILENAME_RE = re.compile(r'[^\w\s\-.]', re.UNICODE)


def sanitize_filename(name: str) -> str:
    """Remove dangerous characters from filename."""
    name = name.replace("/", "_").replace("\\", "_").replace("\x00", "")
    name = SAFE_FILENAME_RE.sub('_', name)
    name = re.sub(r'_+', '_', name).strip('_. ')
    return name or "unnamed"


def validate_file(file: UploadFile):
    """Validate file extension."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome file mancante")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo di file non consentito: {ext}. Formati accettati: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )


# ── Helpers ──────────────────────────────────────────────
def _sanitize_header_value(value: str) -> str:
    """Remove characters unsafe for HTTP header values."""
    # Only allow printable ASCII minus quotes and backslash
    return re.sub(r'[^\w\s\-.()\[\]]', '_', value or "download")


def _check_content_access(content: Content, user: "CurrentUser"):
    """Enforce access rules: marketing only sees completed/archived."""
    if user.is_marketing and content.status not in ("completato", "archiviato"):
        raise HTTPException(status_code=403, detail="Non hai i permessi per questo contenuto")


# ── Drive status check (static route BEFORE parameterized routes) ──
@router.get("/drive-status")
def drive_status(user: "CurrentUser" = Depends(require_admin)):
    """Check if Google Drive is properly configured."""
    return {"configured": drive_is_configured()}


# ── Upload ───────────────────────────────────────────────
@router.post("/{content_id}/upload")
async def upload_file(
    content_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_editor),
):
    """Upload a file to Google Drive. Admin and collaborators only."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    # Validate
    validate_file(file)

    # Read file bytes
    file_data = await file.read()
    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File troppo grande. Massimo consentito: {MAX_FILE_SIZE_MB}MB"
        )

    original_name = sanitize_filename(file.filename)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    drive_name = f"{timestamp}_{content_id}_{original_name}"

    # Detect MIME type
    mime_type = file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

    # Upload to Google Drive (PRIMARY storage)
    logger.info(f"Uploading to Drive for content {content_id}: {original_name} ({len(file_data)} bytes)")
    try:
        result = upload_to_drive(
            file_data=file_data,
            file_name=drive_name,
            mime_type=mime_type,
            brand=content.brand.value if content.brand else "other",
            content_type=content.content_type.value if content.content_type else "other",
            channel=content.channel.value if content.channel else "other",
            title=content.title,
            existing_folder_id=content.drive_folder_id,
        )
    except Exception as e:
        logger.error(f"Drive upload exception for content {content_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Errore Google Drive: {str(e)}"
        )

    if not result:
        raise HTTPException(
            status_code=502,
            detail="Google Drive non configurato. Verifica GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_DRIVE_FOLDER_ID."
        )

    drive_file_id, drive_link, folder_id = result

    # Save metadata on content (latest file stays as "main")
    content.file_name = original_name
    content.file_path = None  # No local storage
    content.drive_file_id = drive_file_id
    content.drive_link = drive_link
    content.drive_folder_id = folder_id
    content.updated_at = datetime.now(timezone.utc)

    # Track this file version
    cf = ContentFile(
        content_id=content_id,
        file_name=original_name,
        drive_file_id=drive_file_id,
        drive_link=drive_link,
        mime_type=mime_type,
        size_bytes=len(file_data),
    )
    db.add(cf)

    # Generate thumbnail from bytes (images/videos)
    thumb_path = generate_thumbnail_from_bytes(file_data, original_name, content_id)
    if thumb_path:
        content.thumbnail_path = thumb_path

    db.commit()
    db.refresh(content)

    logger.info(f"Upload complete for content {content_id}: drive_id={drive_file_id}, folder={folder_id}")

    return {
        "message": "File caricato su Drive",
        "file_name": original_name,
        "has_thumbnail": bool(thumb_path),
        "drive_link": drive_link,
        "drive_file_id": drive_file_id,
        "drive_folder_id": folder_id,
    }


# ── Multi-upload (multiple files → same Drive folder) ───
@router.post("/{content_id}/upload-multi")
async def upload_multi(
    content_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_editor),
):
    """Upload multiple files to the same Drive folder for a content item."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    results = []
    first_thumb = None
    first_drive_link = None
    first_drive_file_id = None
    first_file_name = None
    folder_id = content.drive_folder_id  # Reuse existing folder if available

    for file in files:
        validate_file(file)
        file_data = await file.read()
        if len(file_data) > MAX_FILE_SIZE:
            results.append({"file_name": file.filename, "error": f"Troppo grande (max {MAX_FILE_SIZE_MB}MB)"})
            continue

        original_name = sanitize_filename(file.filename)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        drive_name = f"{timestamp}_{content_id}_{original_name}"
        mime_type = file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

        try:
            result = upload_to_drive(
                file_data=file_data,
                file_name=drive_name,
                mime_type=mime_type,
                brand=content.brand.value if content.brand else "other",
                content_type=content.content_type.value if content.content_type else "other",
                channel=content.channel.value if content.channel else "other",
                title=content.title,
                existing_folder_id=folder_id,
            )
        except Exception as e:
            logger.error(f"Multi-upload Drive error for {original_name}: {e}")
            results.append({"file_name": original_name, "error": str(e)})
            continue

        if not result:
            results.append({"file_name": original_name, "error": "Drive non configurato"})
            continue

        drive_file_id, drive_link, returned_folder_id = result
        folder_id = returned_folder_id  # All subsequent files go into the same folder
        results.append({"file_name": original_name, "drive_link": drive_link, "ok": True})

        # Track this file version
        cf = ContentFile(
            content_id=content_id,
            file_name=original_name,
            drive_file_id=drive_file_id,
            drive_link=drive_link,
            mime_type=mime_type,
            size_bytes=len(file_data),
        )
        db.add(cf)

        # Keep first image as main file for the content record
        ext = os.path.splitext(original_name)[1].lower()
        if first_drive_link is None and ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            first_drive_link = drive_link
            first_drive_file_id = drive_file_id
            first_file_name = original_name
            # Generate thumbnail from first image
            thumb_path = generate_thumbnail_from_bytes(file_data, original_name, content_id)
            if thumb_path:
                first_thumb = thumb_path

        # Fallback: use first file of any type
        if first_drive_link is None:
            first_drive_link = drive_link
            first_drive_file_id = drive_file_id
            first_file_name = original_name

    # Update content record with the main file info
    if first_drive_link:
        content.drive_link = first_drive_link
        content.drive_file_id = first_drive_file_id
        content.file_name = first_file_name
        content.file_path = None
        content.drive_folder_id = folder_id
        if first_thumb:
            content.thumbnail_path = first_thumb
        content.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(content)

    ok_count = sum(1 for r in results if r.get("ok"))
    err_count = len(results) - ok_count

    return {
        "message": f"{ok_count} file caricati, {err_count} errori",
        "files": results,
        "ok_count": ok_count,
        "error_count": err_count,
    }


# ── List all file versions for a content ─────────────────
@router.get("/{content_id}/versions")
def list_file_versions(
    content_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """List all uploaded file versions for a content item."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    files = (
        db.query(ContentFile)
        .filter(ContentFile.content_id == content_id)
        .order_by(ContentFile.uploaded_at.desc())
        .all()
    )

    folder_link = None
    if content.drive_folder_id:
        folder_link = f"https://drive.google.com/drive/folders/{content.drive_folder_id}"

    return {
        "drive_folder_id": content.drive_folder_id,
        "drive_folder_link": folder_link,
        "files": [
            {
                "id": f.id,
                "file_name": f.file_name,
                "drive_file_id": f.drive_file_id,
                "drive_link": f.drive_link,
                "mime_type": f.mime_type,
                "size_bytes": f.size_bytes,
                "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
            }
            for f in files
        ],
    }


# ── Download (proxy from Drive) ─────────────────────────
@router.get("/{content_id}/download")
def download_file(
    content_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Download file — streams from Google Drive."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    # Access control
    _check_content_access(content, user)

    # Try Drive download first (primary)
    if content.drive_file_id:
        result = download_from_drive(content.drive_file_id)
        if result:
            file_bytes, mime_type = result
            safe_name = _sanitize_header_value(content.file_name)
            return Response(
                content=file_bytes,
                media_type=mime_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{safe_name}"',
                },
            )
        else:
            logger.error(f"Drive download failed for content {content_id}, drive_id={content.drive_file_id}")

    # Fallback to local file (legacy, pre-Drive content)
    if content.file_path and os.path.exists(content.file_path):
        return FileResponse(
            content.file_path,
            filename=content.file_name or "download",
            media_type="application/octet-stream",
        )

    raise HTTPException(status_code=404, detail="File non trovato")


# ── Thumbnail ────────────────────────────────────────────
@router.get("/{content_id}/thumbnail")
def get_thumbnail(
    content_id: int,
    regen: bool = False,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Serve the thumbnail image for a content item.

    By default, returns existing thumbnail or 404 (fast path for lists).
    With ?regen=true, regenerates from Drive if thumbnail is missing (detail view only).
    Thumbnails are visible to ALL authenticated users regardless of content status.
    """
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    # Check if thumbnail exists on disk
    has_local = (
        content.thumbnail_path
        and os.path.exists(content.thumbnail_path)
    )

    if has_local:
        # Fast path — serve from disk
        real_thumb = os.path.realpath(content.thumbnail_path)
        real_thumb_dir = os.path.realpath(THUMB_DIR)
        if not real_thumb.startswith(real_thumb_dir):
            raise HTTPException(status_code=403, detail="Accesso non consentito")
        return FileResponse(
            content.thumbnail_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    # No local thumbnail — only regenerate if explicitly requested
    if not regen:
        raise HTTPException(status_code=404, detail="Thumbnail non disponibile")

    # ── On-demand regeneration from Drive (detail view) ──
    file_id = content.drive_file_id
    if not file_id and content.drive_link:
        m = re.search(r'/d/([a-zA-Z0-9_-]+)', content.drive_link)
        if not m:
            m = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', content.drive_link)
        if m:
            file_id = m.group(1)
            content.drive_file_id = file_id

    if not file_id:
        raise HTTPException(status_code=404, detail="Thumbnail non disponibile")

    fname = content.file_name
    if not fname:
        ext_map = {"video": "video.mp4", "grafica": "image.jpg"}
        ct_val = content.content_type.value if content.content_type else "other"
        fname = ext_map.get(ct_val, "file.jpg")

    result = download_from_drive(file_id)
    if not result:
        raise HTTPException(status_code=404, detail="File non disponibile su Drive")

    file_bytes, _ = result
    thumb_path = generate_thumbnail_from_bytes(file_bytes, fname, content_id)
    if not thumb_path:
        raise HTTPException(status_code=404, detail="Impossibile generare thumbnail per questo tipo di file")

    content.thumbnail_path = thumb_path
    if not content.file_name:
        content.file_name = fname
    db.commit()

    return FileResponse(
        thumb_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
