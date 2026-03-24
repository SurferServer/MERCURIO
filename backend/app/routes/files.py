import os
import re
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Content
from ..auth import get_current_user, require_editor, CurrentUser
from ..services.thumbnail_service import generate_thumbnail
from ..services.drive_service import upload_to_drive

router = APIRouter(prefix="/api/files", tags=["files"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Security: file validation ────────────────────────────
MAX_FILE_SIZE_MB = int(os.getenv("MERCURIO_MAX_UPLOAD_MB", "50"))
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

# Characters allowed in filenames (alphanumeric, dash, underscore, dot, space)
SAFE_FILENAME_RE = re.compile(r'[^\w\s\-.]', re.UNICODE)


def sanitize_filename(name: str) -> str:
    """Remove dangerous characters from filename."""
    # Remove path separators and null bytes
    name = name.replace("/", "_").replace("\\", "_").replace("\x00", "")
    # Remove other unsafe characters
    name = SAFE_FILENAME_RE.sub('_', name)
    # Collapse multiple underscores
    name = re.sub(r'_+', '_', name).strip('_. ')
    return name or "unnamed"


def validate_file(file: UploadFile):
    """Validate file extension and content-type."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome file mancante")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo di file non consentito: {ext}. Formati accettati: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )


@router.post("/{content_id}/upload")
async def upload_file(
    content_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_editor),
):
    """Upload a file. Admin and collaborators only."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    # Validate file type
    validate_file(file)

    # Read file with size limit
    file_data = await file.read()
    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File troppo grande. Massimo consentito: {MAX_FILE_SIZE_MB}MB"
        )

    # Create organized directory structure
    brand_dir = content.brand.value if content.brand else "other"
    type_dir = content.content_type.value if content.content_type else "other"
    channel_dir = content.channel.value if content.channel else "other"
    target_dir = os.path.join(UPLOAD_DIR, brand_dir, type_dir, channel_dir)
    os.makedirs(target_dir, exist_ok=True)

    # Sanitize filename
    original_name = sanitize_filename(file.filename)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp}_{content_id}_{original_name}"

    file_path = os.path.join(target_dir, safe_name)

    # Verify final path is within UPLOAD_DIR (prevent traversal)
    real_target = os.path.realpath(file_path)
    real_upload = os.path.realpath(UPLOAD_DIR)
    if not real_target.startswith(real_upload):
        raise HTTPException(status_code=400, detail="Percorso file non valido")

    with open(file_path, "wb") as buffer:
        buffer.write(file_data)

    content.file_name = original_name
    content.file_path = file_path
    content.updated_at = datetime.now(timezone.utc)

    # Generate thumbnail (images: resize, videos: first frame via ffmpeg)
    thumb_path = generate_thumbnail(file_path, content_id)
    if thumb_path:
        content.thumbnail_path = thumb_path

    # Upload to Google Drive (async-safe, non-blocking on failure)
    drive_link = None
    try:
        drive_link = upload_to_drive(
            file_path=file_path,
            file_name=original_name,
            brand=content.brand.value if content.brand else "other",
            content_type=content.content_type.value if content.content_type else "other",
            channel=content.channel.value if content.channel else "other",
        )
        if drive_link:
            content.drive_link = drive_link
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Drive upload error (non-fatal): {e}")

    db.commit()
    db.refresh(content)

    return {
        "message": "File caricato" + (" e sincronizzato su Drive" if drive_link else ""),
        "file_name": original_name,
        "has_thumbnail": bool(thumb_path),
        "drive_link": drive_link,
    }


@router.get("/{content_id}/download")
def download_file(
    content_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Any authenticated user can download."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content or not content.file_path:
        raise HTTPException(status_code=404, detail="File non trovato")

    # Verify path is within upload dir
    real_path = os.path.realpath(content.file_path)
    real_upload = os.path.realpath(UPLOAD_DIR)
    if not real_path.startswith(real_upload):
        raise HTTPException(status_code=403, detail="Accesso non consentito")

    if not os.path.exists(content.file_path):
        raise HTTPException(status_code=404, detail="File non trovato sul disco")

    return FileResponse(
        content.file_path,
        filename=content.file_name or "download",
        media_type="application/octet-stream",
    )


@router.get("/{content_id}/thumbnail")
def get_thumbnail(
    content_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Serve the thumbnail image for a content item."""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content or not content.thumbnail_path:
        raise HTTPException(status_code=404, detail="Thumbnail non disponibile")

    if not os.path.exists(content.thumbnail_path):
        raise HTTPException(status_code=404, detail="Thumbnail non trovata sul disco")

    # Verify path safety
    thumb_dir = os.path.realpath(os.path.join(UPLOAD_DIR, "_thumbnails"))
    real_path = os.path.realpath(content.thumbnail_path)
    if not real_path.startswith(thumb_dir):
        raise HTTPException(status_code=403, detail="Accesso non consentito")

    return FileResponse(
        content.thumbnail_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
