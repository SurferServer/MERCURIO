"""
Google Drive integration service.

Setup instructions:
1. Go to https://console.cloud.google.com/
2. Create a project (or use an existing one)
3. Enable the Google Drive API
4. Create a Service Account under "Credentials"
5. Download the JSON key file
6. Share your target Drive folder with the service account email
7. Set environment variables:
   - GOOGLE_DRIVE_CREDENTIALS_PATH: path to the JSON key file
   - GOOGLE_DRIVE_ROOT_FOLDER_ID: the ID of the root folder on Drive

The folder structure on Drive will be:
  Root/
  ├── Guida e Vai/
  │   ├── Video/
  │   │   ├── Organico/
  │   │   └── ADV/
  │   └── Grafiche/
  │       ├── Organico/
  │       └── ADV/
  ├── Quiz Patente/...
  └── Rinnovala/...
"""

import os
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

CREDENTIALS_PATH = os.getenv("GOOGLE_DRIVE_CREDENTIALS_PATH", "")
ROOT_FOLDER_ID = os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "")


def _get_drive_service():
    """Initialize Google Drive API service."""
    if not CREDENTIALS_PATH or not os.path.exists(CREDENTIALS_PATH):
        logger.warning("Google Drive credentials not configured")
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        credentials = service_account.Credentials.from_service_account_file(
            CREDENTIALS_PATH,
            scopes=["https://www.googleapis.com/auth/drive"],
        )
        return build("drive", "v3", credentials=credentials)
    except Exception as e:
        logger.error(f"Failed to initialize Drive service: {e}")
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
    Returns the Drive file URL or None if upload fails.
    """
    service = _get_drive_service()
    if not service or not ROOT_FOLDER_ID:
        logger.info("Drive sync skipped (not configured)")
        return None

    try:
        brand_label = BRAND_LABELS.get(brand, brand)
        type_label = TYPE_LABELS.get(content_type, content_type)
        channel_label = CHANNEL_LABELS.get(channel, channel)

        # Navigate/create folder structure
        brand_folder = _find_or_create_folder(service, brand_label, ROOT_FOLDER_ID)
        type_folder = _find_or_create_folder(service, type_label, brand_folder)
        channel_folder = _find_or_create_folder(service, channel_label, type_folder)

        # Upload file
        from googleapiclient.http import MediaFileUpload

        file_metadata = {
            "name": file_name,
            "parents": [channel_folder],
        }
        media = MediaFileUpload(file_path)
        uploaded = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, webViewLink",
        ).execute()

        link = uploaded.get("webViewLink", "")
        logger.info(f"Uploaded to Drive: {link}")
        return link

    except Exception as e:
        logger.error(f"Drive upload failed: {e}")
        return None
