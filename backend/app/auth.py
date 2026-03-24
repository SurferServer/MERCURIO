"""
Authentication & authorization module for MERCURIO.

Uses JWT tokens issued at login. Each request must include
Authorization: Bearer <token> header. The token encodes
user_id and role, validated server-side on every request.
"""

import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import jwt

# ── Secret key ────────────────────────────────────────────
# In production, always set MERCURIO_JWT_SECRET as env variable.
JWT_SECRET = os.getenv("MERCURIO_JWT_SECRET", "")
if not JWT_SECRET:
    # Generate a random secret at startup (safe for single-instance dev)
    JWT_SECRET = secrets.token_hex(32)

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("MERCURIO_JWT_EXPIRE_HOURS", "24"))

# ── Allowed users ─────────────────────────────────────────
USERS = {
    "fulvio":    {"name": "Fulvio",    "role": "admin"},
    "federico":  {"name": "Federico",  "role": "collaborator"},
    "marzia":    {"name": "Marzia",    "role": "collaborator"},
    "marketing": {"name": "Marketing", "role": "marketing"},
}

# ── Token helpers ─────────────────────────────────────────
def create_token(user_id: str) -> str:
    """Create a signed JWT for a known user."""
    user = USERS.get(user_id)
    if not user:
        raise ValueError(f"Unknown user: {user_id}")
    payload = {
        "sub": user_id,
        "role": user["role"],
        "name": user["name"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises on invalid/expired."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")


# ── FastAPI dependencies ──────────────────────────────────
_bearer = HTTPBearer()


class CurrentUser:
    """Parsed user from a valid JWT."""
    def __init__(self, user_id: str, role: str, name: str):
        self.user_id = user_id
        self.role = role
        self.name = name

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_marketing(self) -> bool:
        return self.role == "marketing"

    @property
    def is_collaborator(self) -> bool:
        return self.role == "collaborator"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    """Dependency: extract and validate user from Authorization header."""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id not in USERS:
        raise HTTPException(status_code=401, detail="Utente non riconosciuto")
    return CurrentUser(
        user_id=user_id,
        role=payload["role"],
        name=payload["name"],
    )


def require_role(*allowed_roles: str):
    """Dependency factory: restrict endpoint to specific roles."""
    async def _check(user: CurrentUser = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Non hai i permessi per questa azione",
            )
        return user
    return _check


# Convenience dependencies
require_admin = require_role("admin")
require_editor = require_role("admin", "collaborator")
require_any = require_role("admin", "collaborator", "marketing")
