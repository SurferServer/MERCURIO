"""
Thumbnail generation service.

- Images: resized with Pillow (max 480px wide, JPEG)
- Videos: first frame extracted with ffmpeg (then resized)
- SVG/PDF/PSD: skipped (returns None)
"""

import os
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

THUMB_DIR = os.getenv("UPLOAD_DIR", "./uploads") + "/_thumbnails"
os.makedirs(THUMB_DIR, exist_ok=True)

THUMB_MAX_WIDTH = 480
THUMB_QUALITY = 80

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def _resize_image(input_path: str, output_path: str) -> bool:
    """Resize an image to thumbnail size using Pillow."""
    try:
        from PIL import Image

        # Guard against decompression bombs (~300 megapixels max)
        Image.MAX_IMAGE_PIXELS = 89_478_485

        img = Image.open(input_path)

        # Verify the image data is valid before full decode
        img.verify()
        # Re-open after verify (verify closes the file)
        img = Image.open(input_path)

        # Convert RGBA/palette to RGB for JPEG
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        # Resize maintaining aspect ratio
        if img.width > THUMB_MAX_WIDTH:
            ratio = THUMB_MAX_WIDTH / img.width
            new_size = (THUMB_MAX_WIDTH, int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        img.save(output_path, "JPEG", quality=THUMB_QUALITY, optimize=True)
        return True
    except Image.DecompressionBombError:
        logger.error(f"Image too large (decompression bomb): {input_path}")
        return False
    except Exception as e:
        logger.error(f"Image thumbnail failed: {e}")
        return False


def _extract_video_frame(input_path: str, output_path: str) -> bool:
    """Extract first frame of a video with ffmpeg, then resize."""
    try:
        # Extract frame at 1 second (or 0 if shorter)
        temp_frame = output_path + ".tmp.png"
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-ss", "00:00:01",
                "-vframes", "1",
                "-vf", f"scale={THUMB_MAX_WIDTH}:-1",
                "-q:v", "2",
                temp_frame,
            ],
            capture_output=True,
            timeout=30,
        )
        # If 1s fails (very short video), try 0s
        if result.returncode != 0 or not os.path.exists(temp_frame):
            result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", input_path,
                    "-vframes", "1",
                    "-vf", f"scale={THUMB_MAX_WIDTH}:-1",
                    "-q:v", "2",
                    temp_frame,
                ],
                capture_output=True,
                timeout=30,
            )

        if result.returncode != 0 or not os.path.exists(temp_frame):
            logger.error(f"ffmpeg failed: {result.stderr.decode()[:500]}")
            return False

        # Convert PNG frame to JPEG
        _resize_image(temp_frame, output_path)

        # Clean up temp
        if os.path.exists(temp_frame):
            os.remove(temp_frame)

        return os.path.exists(output_path)

    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timed out")
        return False
    except Exception as e:
        logger.error(f"Video thumbnail failed: {e}")
        return False


def generate_thumbnail(file_path: str, content_id: int) -> str | None:
    """
    Generate a thumbnail for the given file.
    Returns the thumbnail file path, or None if unsupported/failed.
    """
    ext = Path(file_path).suffix.lower()
    thumb_name = f"thumb_{content_id}.jpg"
    thumb_path = os.path.join(THUMB_DIR, thumb_name)

    if ext in IMAGE_EXTENSIONS:
        if _resize_image(file_path, thumb_path):
            return thumb_path
    elif ext in VIDEO_EXTENSIONS:
        if _extract_video_frame(file_path, thumb_path):
            return thumb_path
    else:
        logger.info(f"Thumbnail not supported for extension: {ext}")

    return None
