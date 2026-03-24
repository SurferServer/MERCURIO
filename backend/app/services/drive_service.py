"""
Google Drive integration service.

Uploads files to a shared Google Drive folder, organized by brand/type/channel.
Uses a Service Account — credentials are read from the environment variable
GOOGLE_SERVICE_ACCOUNT_JSON (the full JSON content of the key file).

Folder structure on Drive:
  MERCURIO (root) / {brand} / {content_type} / {channel} / filename
"""

import os
import json
import logging
from typing import Optional

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
    """Initialize and cache the Google Drive API service."""
    global _drive_service
    if _drive_service is not None:
        return _drive_service

    creds_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not creds_json or not ROOT_FOLDER_ID:
        logger.warning("Google Drive not configured (missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_FOLDER_ID)")
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds_info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_info,
            scopes=["https://www.googleapis.com/auth/drive"],
        )
        _drive_service = build("drive", "v3", credentials=creds)
        logger.info("Google Drive service initialized successfully")
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
    query = f"name='{safe_name}' and '{safe_parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
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


def upload_to_drive(
    file_path: str,
    file_name: str,
    brand: str,
    content_type: str,
    channel: str,
) -> Optional[str]:
    """
    Upload a file to Google Drive in the correct folder structure.
    Returns the Drive web view link, or None if not configured / fails.
    """
    service = _get_drive_service()
    if not service or not ROOT_FOLDER_ID:
        logger.info("Drive sync skipped (not configured)")
        return None

    try:
        from googleapiclient.http import MediaFileUpload

        brand_label = BRAND_LABELS.get(brand, brand)
        type_label = TYPE_LABELS.get(content_type, content_type)
        channel_label = CHANNEL_LABELS.get(channel, channel)

        # Navigate/create folder structure
        brand_folder = _find_or_create_folder(service, brand_label, ROOT_FOLDER_ID)
        type_folder = _find_or_create_folder(service, type_label, brand_folder)
        channel_folder = _find_or_create_folder(service, channel_label, type_folder)

        # Upload file
        file_metadata = {
            "name": file_name,
            "parents": [channel_folder],
        }
        media = MediaFileUpload(file_path, resumable=True)
        uploaded = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, webViewLink",
        ).execute()

        link = uploaded.get("webViewLink", "")
        logger.info(f"Uploaded to Drive: {file_name} → {link}")
        return link

    except Exception as e:
        logger.error(f"Drive upload failed for {file_name}: {e}")
        return None
