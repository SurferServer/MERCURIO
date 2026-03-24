import os
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
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

# Serve frontend build in production
# Check multiple possible locations (local dev vs Docker container)
_possible_dist = [
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"),  # local dev
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"),        # Render container
    "/app/frontend/dist",                                                      # absolute fallback
]
for _dist_path in _possible_dist:
    if os.path.exists(_dist_path):
        app.mount("/", StaticFiles(directory=_dist_path, html=True), name="frontend")
        break


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "MERCURIO"}
