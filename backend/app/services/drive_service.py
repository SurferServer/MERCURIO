"""
Google Drive integration service — PRIMARY STORAGE.

All content files are stored on Google Drive. Local disk is only used
as a temporary buffer during upload/thumbnail generation.

Folder structure on Drive:
  MERCURIO (root) / {brand} / {content_type} / {channel} / filename

Uses OAuth2 credentials (refresh token) — authenticates as the user's
personal Google account so files count against their Drive quota.

Required env vars:
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GOOGLE_OAUTH_REFRESH_TOKEN
  GOOGLE_DRIVE_FOLDER_ID
"""

import io
import os
import json
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

BRAND_LABELS = {
    "guida-e-vai": "Guida e Vai",
    "quiz-patente": "Quiz Patente",
    "rinnovala": "Rinnovala",
}
TYPE_LABELS = {
    "video": "Video",
    "grafica": "Grafiche",
}
CHANNEL_LABELS = {
    "organico": "Organico",
    "adv": "ADV",
}

ROOT_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")

# Lazy-loaded Drive service
_drive_service = None


def _get_drive_service():
    """Initialize and cache the Google Drive API service using OAuth2."""
    global _drive_service
    if _drive_service is not None:
        return _drive_service

    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
    refresh_token = os.getenv("GOOGLE_OAUTH_REFRESH_TOKEN", "")

    if not all([client_id, client_secret, refresh_token, ROOT_FOLDER_ID]):
        logger.warning(
            f"Google Drive not configured — "
            f"client_id={'YES' if client_id else 'MISSING'}, "
            f"client_secret={'YES' if client_secret else 'MISSING'}, "
            f"refresh_token={'YES' if refresh_token else 'MISSING'}, "
            f"folder_id={'YES' if ROOT_FOLDER_ID else 'MISSING'}"
        )
        return None

    # Debug: log values and test token refresh manually
    logger.error(
        f"OAuth2 DEBUG: client_id={client_id[:12]}...{client_id[-20:]} "
        f"(len={len(client_id)}), "
        f"secret={client_secret[:8]}... (len={len(client_secret)}), "
        f"refresh_len={len(refresh_token)}"
    )

    # Test manual token refresh to get detailed error
    try:
        import requests as _req
        test_resp = _req.post("https://oauth2.googleapis.com/token", data={
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
        })
        logger.error(f"OAuth2 manual refresh test: status={test_resp.status_code}, body={test_resp.text[:500]}")
    except Exception as te:
        logger.error(f"OAuth2 manual refresh test failed: {te}")

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,  # will be refreshed automatically
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=["https://www.googleapis.com/auth/drive"],
        )
        _drive_service = build("drive", "v3", credentials=creds)
        logger.error("Google Drive service initialized with OAuth2 OK")
        return _drive_service
    except Exception as e:
        logger.error(f"Failed to initialize Google Drive: {e}")
        return None


def _sanitize_drive_query_value(value: str) -> str:
    """Escape single quotes and backslashes for Drive API query strings."""
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _find_or_create_folder(service, name: str, parent_id: str) -> str:
    """Find a folder by name under parent, or create it."""
    safe_name = _sanitize_drive_query_value(name)
    safe_parent = _sanitize_drive_query_value(parent_id)
    query = (
        f"name='{safe_name}' and '{safe_parent}' in parents "
        f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )
    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get("files", [])

    if files:
        return files[0]["id"]

    folder_metadata = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    }
    folder = service.files().create(body=folder_metadata, fields="id").execute()
    logger.info(f"Created Drive folder: {name} (id={folder['id']})")
    return folder["id"]


def is_configured() -> bool:
    """Check if Drive integration is properly configured."""
    return _get_drive_service() is not None


def upload_to_drive(
    file_data: bytes,
    file_name: str,
    mime_type: str,
    brand: str,
    content_type: str,
    channel: str,
) -> Optional[Tuple[str, str]]:
    """
    Upload file bytes to Google Drive.
    Returns (drive_file_id, webViewLink) or None on failure.
    """
    service = _get_drive_service()
    if not service or not ROOT_FOLDER_ID:
        logger.warning("Drive upload skipped (not configured)")
        return None

    try:
        from googleapiclient.http import MediaIoBaseUpload

        logger.info(
            f"Drive upload: {file_name} ({len(file_data)} bytes) "
            f"→ {brand}/{content_type}/{channel}"
        )

        brand_label = BRAND_LABELS.get(brand, brand)
        type_label = TYPE_LABELS.get(content_type, content_type)
        channel_label = CHANNEL_LABELS.get(channel, channel)

        # Navigate/create folder structure
        brand_folder = _find_or_create_folder(service, brand_label, ROOT_FOLDER_ID)
        type_folder = _find_or_create_folder(service, type_label, brand_folder)
        channel_folder = _find_or_create_folder(service, channel_label, type_folder)

        # Upload file from memory
        file_metadata = {
            "name": file_name,
            "parents": [channel_folder],
        }
        media = MediaIoBaseUpload(
            io.BytesIO(file_data),
            mimetype=mime_type or "application/octet-stream",
            resumable=True,
        )
        uploaded = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, webViewLink",
        ).execute()

        file_id = uploaded.get("id", "")
        link = uploaded.get("webViewLink", "")
        logger.info(f"Drive upload OK: {file_name} → id={file_id}, link={link}")
        return (file_id, link)

    except Exception as e:
        logger.error(f"Drive upload failed for {file_name}: {e}", exc_info=True)
        raise RuntimeError(f"Drive upload: {e}") from e


def download_from_drive(drive_file_id: str) -> Optional[Tuple[bytes, str]]:
    """
    Download file content from Drive by file ID.
    Returns (file_bytes, mime_type) or None on failure.
    """
    service = _get_drive_service()
    if not service:
        return None

    try:
        from googleapiclient.http import MediaIoBaseDownload

        # Get file metadata for mime type
        meta = service.files().get(
            fileId=drive_file_id, fields="mimeType, name"
        ).execute()
        mime_type = meta.get("mimeType", "application/octet-stream")

        # Download content
        request = service.files().get_media(fileId=drive_file_id)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        buffer.seek(0)
        return (buffer.read(), mime_type)

    except Exception as e:
        logger.error(f"Drive download failed for {drive_file_id}: {e}", exc_info=True)
        return None


def delete_from_drive(drive_file_id: str) -> bool:
    """Delete a file from Drive. Returns True on success."""
    service = _get_drive_service()
    if not service:
        return False

    try:
        service.files().delete(fileId=drive_file_id).execute()
        logger.info(f"Deleted from Drive: {drive_file_id}")
        return True
    except Exception as e:
        logger.error(f"Drive delete failed for {drive_file_id}: {e}", exc_info=True)
        return False
