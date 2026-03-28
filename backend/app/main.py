import os
from fastapi import FastAPI, Request, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from PIL import Image as PILImage
import io

from .database import engine, Base
from .routes import contents, files, comments, script_briefs, dev_tasks, popups, notifications
from .auth import create_token, verify_password, USERS, get_current_user, CurrentUser

import logging
from sqlalchemy import text, inspect

logger = logging.getLogger(__name__)

# Create tables (new tables only — existing ones are left untouched)
Base.metadata.create_all(bind=engine)

# ── Lightweight migration: add missing columns to existing tables ──
def _run_migrations():
    """Add columns that were introduced after initial deployment."""
    inspector = inspect(engine)
    migrations = []

    # script_brief_id on contents table (added with Script/Brief feature)
    if "contents" in inspector.get_table_names():
        existing_cols = {c["name"] for c in inspector.get_columns("contents")}
        if "script_brief_id" not in existing_cols:
            migrations.append(
                "ALTER TABLE contents ADD COLUMN script_brief_id INTEGER REFERENCES script_briefs(id)"
            )
        if "drive_file_id" not in existing_cols:
            migrations.append(
                "ALTER TABLE contents ADD COLUMN drive_file_id VARCHAR(200)"
            )
        if "drive_folder_id" not in existing_cols:
            migrations.append(
                "ALTER TABLE contents ADD COLUMN drive_folder_id VARCHAR(200)"
            )

    with engine.begin() as conn:
        for sql in migrations:
            logger.info(f"Running migration: {sql}")
            conn.execute(text(sql))

    if migrations:
        logger.info(f"Applied {len(migrations)} migration(s)")

    # Add 'SVILUPPO' to contenttypeenum if missing (PostgreSQL enum migration)
    # Must run outside a transaction — ALTER TYPE ... ADD VALUE cannot be in a tx block
    if "contents" in inspector.get_table_names():
        try:
            with engine.connect() as conn:
                result = conn.execute(text(
                    "SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SVILUPPO' "
                    "AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contenttypeenum'))"
                ))
                exists = result.scalar()
            if not exists:
                # Use raw connection with autocommit for ALTER TYPE
                raw_conn = engine.raw_connection()
                try:
                    raw_conn.set_isolation_level(0)  # AUTOCOMMIT
                    cursor = raw_conn.cursor()
                    cursor.execute("ALTER TYPE contenttypeenum ADD VALUE IF NOT EXISTS 'SVILUPPO'")
                    cursor.close()
                    raw_conn.commit()
                    logger.info("Added 'SVILUPPO' to contenttypeenum")
                finally:
                    raw_conn.close()
        except Exception as e:
            logger.info(f"Enum migration skipped (probably SQLite): {e}")

    # Add 'FULVIO' to assigneeenum if missing
    # SQLAlchemy uses enum NAMES (uppercase) as DB values by default
    try:
        raw_conn = engine.raw_connection()
        try:
            raw_conn.set_isolation_level(0)  # AUTOCOMMIT
            cursor = raw_conn.cursor()
            cursor.execute("ALTER TYPE assigneeenum ADD VALUE IF NOT EXISTS 'FULVIO' BEFORE 'FEDERICO'")
            cursor.close()
            raw_conn.commit()
            logger.info("Added 'FULVIO' to assigneeenum")
        finally:
            raw_conn.close()
    except Exception as e:
        logger.info(f"Assignee enum migration skipped (probably SQLite): {e}")

    # Add 'CARTACEO' to channelenum if missing
    try:
        raw_conn = engine.raw_connection()
        try:
            raw_conn.set_isolation_level(0)  # AUTOCOMMIT
            cursor = raw_conn.cursor()
            cursor.execute("ALTER TYPE channelenum ADD VALUE IF NOT EXISTS 'CARTACEO'")
            cursor.close()
            raw_conn.commit()
            logger.info("Added 'CARTACEO' to channelenum")
        finally:
            raw_conn.close()
    except Exception as e:
        logger.info(f"Channel enum migration skipped (probably SQLite): {e}")

    # Add pair assignees to assigneeenum if missing
    for pair_value in ('FEDERICO_MARZIA', 'FULVIO_FEDERICO', 'FULVIO_MARZIA'):
        try:
            raw_conn = engine.raw_connection()
            try:
                raw_conn.set_isolation_level(0)  # AUTOCOMMIT
                cursor = raw_conn.cursor()
                cursor.execute(f"ALTER TYPE assigneeenum ADD VALUE IF NOT EXISTS '{pair_value}'")
                cursor.close()
                raw_conn.commit()
                logger.info(f"Added '{pair_value}' to assigneeenum")
            finally:
                raw_conn.close()
        except Exception as e:
            logger.info(f"Assignee pair enum migration skipped for {pair_value}: {e}")

try:
    _run_migrations()
except Exception as e:
    logger.error(f"Migration failed (non-fatal): {e}")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="MERCURIO",
    description="MERCURIO - Gestione Contenuti Social",
    version="1.0.0",
    docs_url=None if os.getenv("MERCURIO_ENV") == "production" else "/docs",
    redoc_url=None,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Troppe richieste. Riprova tra poco."},
    )


# CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Auth endpoints ────────────────────────────────────────
class LoginRequest(BaseModel):
    user_id: str
    password: str


@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, data: LoginRequest):
    if data.user_id not in USERS:
        # Use same error message to not reveal if user exists
        return JSONResponse(
            status_code=401,
            content={"detail": "Credenziali non valide"},
        )
    if not verify_password(data.user_id, data.password):
        return JSONResponse(
            status_code=401,
            content={"detail": "Credenziali non valide"},
        )
    token = create_token(data.user_id)
    user = USERS[data.user_id]
    return {
        "token": token,
        "user_id": data.user_id,
        "name": user["name"],
        "role": user["role"],
    }


@app.get("/api/auth/me")
async def get_me(user: CurrentUser = Depends(get_current_user)):
    return {
        "user_id": user.user_id,
        "name": user.name,
        "role": user.role,
    }


# ── Avatar management ─────────────────────────────────────
AVATAR_DIR = os.path.join(os.getenv("UPLOAD_DIR", "./uploads"), "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

AVATAR_MAX_SIZE = 400  # px – avatar will be resized to this square


@app.post("/api/auth/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload or replace the current user's profile photo."""
    if not file.content_type or not file.content_type.startswith("image/"):
        return JSONResponse(status_code=400, content={"detail": "Il file deve essere un'immagine"})

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5 MB limit
        return JSONResponse(status_code=400, content={"detail": "Immagine troppo grande (max 5 MB)"})

    try:
        img = PILImage.open(io.BytesIO(contents))
        img = img.convert("RGB")
        # Crop to square (center crop)
        w, h = img.size
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
        # Resize
        img = img.resize((AVATAR_MAX_SIZE, AVATAR_MAX_SIZE), PILImage.LANCZOS)
        # Save
        out_path = os.path.join(AVATAR_DIR, f"{user.user_id}.jpg")
        img.save(out_path, "JPEG", quality=90)
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "Impossibile elaborare l'immagine"})

    return {"ok": True, "url": f"/avatars/{user.user_id}.jpg"}


@app.delete("/api/auth/avatar")
async def delete_avatar(user: CurrentUser = Depends(get_current_user)):
    """Remove the current user's profile photo."""
    path = os.path.join(AVATAR_DIR, f"{user.user_id}.jpg")
    if os.path.exists(path):
        os.remove(path)
    return {"ok": True}


@app.get("/avatars/{filename}")
async def serve_avatar(filename: str):
    """Serve avatar images (no auth needed for display)."""
    # Security: prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        return JSONResponse(status_code=400, content={"detail": "Nome file non valido"})
    path = os.path.realpath(os.path.join(AVATAR_DIR, filename))
    if not path.startswith(os.path.realpath(AVATAR_DIR)):
        return JSONResponse(status_code=403, content={"detail": "Accesso non consentito"})
    if os.path.isfile(path):
        return FileResponse(path, media_type="image/jpeg",
                            headers={"X-Content-Type-Options": "nosniff"})
    return JSONResponse(status_code=404, content={"detail": "Avatar non trovato"})


# API routes
app.include_router(contents.router)
app.include_router(files.router)
app.include_router(comments.router)
app.include_router(script_briefs.router)
app.include_router(dev_tasks.router)
app.include_router(popups.router)
app.include_router(notifications.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "MERCURIO"}


# Serve frontend build in production
# Check multiple possible locations (local dev vs Docker container)
_dist_path = None
_possible_dist = [
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"),  # local dev
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"),        # Render container
    "/app/frontend/dist",                                                      # absolute fallback
]
for _p in _possible_dist:
    if os.path.exists(_p):
        _dist_path = os.path.realpath(_p)
        break

if _dist_path:
    # Serve static assets (JS, CSS, images)
    _assets_path = os.path.join(_dist_path, "assets")
    if os.path.exists(_assets_path):
        app.mount("/assets", StaticFiles(directory=_assets_path), name="assets")

    # SPA catch-all: any non-API route returns index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.realpath(os.path.join(_dist_path, full_path))
        # Security: prevent path traversal outside dist directory
        if not file_path.startswith(_dist_path):
            return FileResponse(os.path.join(_dist_path, "index.html"))
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_dist_path, "index.html"))
