import os
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .database import engine, Base
from .routes import contents, files, comments
from .auth import create_token, USERS, get_current_user, CurrentUser

# Create tables
Base.metadata.create_all(bind=engine)

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


@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, data: LoginRequest):
    if data.user_id not in USERS:
        return JSONResponse(
            status_code=401,
            content={"detail": "Utente non riconosciuto"},
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


# API routes
app.include_router(contents.router)
app.include_router(files.router)
app.include_router(comments.router)

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
        file_path = os.path.join(_dist_path, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_dist_path, "index.html"))
