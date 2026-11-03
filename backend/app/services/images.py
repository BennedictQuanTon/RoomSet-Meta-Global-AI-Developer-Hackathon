"""Decodes untrusted images and re-encodes them, which fixes orientation and strips EXIF/GPS."""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import AppError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 40_000_000
MAX_EDGE = 2048


@dataclass
class CleanImage:
    data: bytes
    width: int
    height: int
    pixels: Image.Image


def clean_image(raw: bytes, max_edge: int = MAX_EDGE) -> CleanImage:
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise AppError("unsupported_image", "Use a JPEG, PNG or WebP image.", 415)
            if probe.width * probe.height > MAX_PIXELS:
                raise AppError("image_too_large", "That image is too large.", 413)
            image = ImageOps.exif_transpose(probe).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise AppError("unsupported_image", "Use a JPEG, PNG or WebP image.", 415) from exc

    image.thumbnail((max_edge, max_edge))
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=88, optimize=True)
    return CleanImage(buffer.getvalue(), image.width, image.height, image)
