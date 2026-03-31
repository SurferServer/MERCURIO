"""
Authentication & authorization module for MERCURIO.

Uses JWT tokens issued at login. Each request must include
Authorization: Bearer <token> header. The token encodes
user_id and role, validated server-side on every request.

Passwords are read from environment variables:
  MERCURIO_PASS_FULVIO, MERCURIO_PASS_FEDERICO,
  MERCURIO_PASS_MARZIA, MERCURIO_PASS_MARKETING
"""

import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import jwt

logger = logging.getLogger(__name__)

# ── Secret key ────────────────────────────────────────────
# In production, MERCURIO_JWT_SECRET MUST be set as env variable.
JWT_SECRET = os.getenv("MERCURIO_JWT_SECRET", "")
_is_production = os.getenv("MERCURIO_ENV") == "production"
if not JWT_SECRET:
    if _is_production:
        raise RuntimeError(
            "MERCURIO_JWT_SECRET non configurato! "
            "In produzione questa variabile è obbligatoria."
        )
    # Generate a random secret at startup (safe for single-instance dev)
    JWT_SECRET = secrets.token_hex(32)
    logger.warning("JWT secret generato casualmente — i token non sopravvivranno al restart")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("MERCURIO_JWT_EXPIRE_HOURS", "24"))

# ── Allowed users ─────────────────────────────────────────
USERS = {
    "fulvio":    {"name": "Fulvio",    "role": "admin"},
    "federico":  {"name": "Federico",  "role": "collaborator"},
    "marzia":    {"name": "Marzia",    "role": "collaborator"},
    "marketing": {"name": "Marketing", "role": "marketing"},
}

# ── Password management ──────────────────────────────────
# Passwords are read from env vars: MERCURIO_PASS_{USER_ID_UPPER}
# In production these MUST be set. In dev, if missing, login is blocked.

def _get_user_password(user_id: str) -> Optional[str]:
    """Get the expected password for a user from environment."""
    env_key = f"MERCURIO_PASS_{user_id.upper()}"
    return os.getenv(env_key)


def verify_password(user_id: str, password: str) -> bool:
    """
    Verify a password for a given user.
    Supports both bcrypt hashes (recommended) and plaintext (legacy).
    Bcrypt hashes start with '$2b$' — everything else is treated as plaintext
    with timing-safe comparison.
    """
    expected = _get_user_password(user_id)
    if not expected:
        logger.warning(f"No password configured for user '{user_id}' (missing env var MERCURIO_PASS_{user_id.upper()})")
        return False

    # Bcrypt hash detection: hashes start with $2b$, $2a$, or $2y$
    if expected.startswith(("$2b$", "$2a$", "$2y$")):
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"),
                expected.encode("utf-8"),
            )
        except Exception as e:
            logger.error(f"Bcrypt verification failed for user '{user_id}': {e}")
            return False

    # Legacy plaintext comparison (timing-safe)
    if _is_production:
        logger.warning(
            f"User '{user_id}' uses plaintext password — "
            f"genera un hash con: python -c \"import bcrypt; print(bcrypt.hashpw(b'PASSWORD', bcrypt.gensalt()).decode())\""
        )
    return secrets.compare_digest(password, expected)


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
