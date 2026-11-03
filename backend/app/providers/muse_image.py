"""Muse Image edits on Meta Model API (docs checked 2 Nov 2026; no live call recorded yet).

Raw HTTP form: JSON with an `images` array of {image_url}. `mask` is rejected by the API.
Tools are off and reasoning is low so a preview stays quick and bounded.
"""

import base64
import logging

import httpx

from app.core import budget
from app.core.config import get_settings
from app.core.errors import ProviderUnavailable

log = logging.getLogger(__name__)


def data_url(data: bytes, media_type: str) -> str:
    return f"data:{media_type};base64,{base64.b64encode(data).decode()}"


def edit_image(
    prompt: str, images: list[tuple[bytes, str]], client: httpx.Client | None = None
) -> bytes:
    settings = get_settings()
    if not settings.image_enabled:
        raise ProviderUnavailable("image_not_configured", "Style previews are not configured.")

    payload = {
        "model": settings.muse_image_model,
        "prompt": prompt,
        "n": 1,
        "images": [{"image_url": data_url(data, media)} for data, media in images],
        "response_format": "b64_json",
        "output_format": "jpeg",
        "reasoning_strength": "low",
        "tool_enablement": {
            "enable_image_search": False,
            "enable_web_search": False,
            "enable_shell": False,
        },
    }
    budget.reserve("image", budget.IMAGE_PER_CALL)
    http = client or httpx.Client(timeout=settings.provider_timeout_s)
    try:
        response = http.post(
            f"{settings.meta_base_url}/images/edits",
            json=payload,
            headers={"Authorization": f"Bearer {settings.muse_api}"},
        )
        response.raise_for_status()
        return base64.b64decode(response.json()["data"][0]["b64_json"], validate=True)
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        log.warning("muse image failed", extra={"fields": {"error_type": type(exc).__name__}})
        raise ProviderUnavailable(
            "image_failed", "The style preview did not finish. Your layout is safe; try again."
        ) from exc
    finally:
        if client is None:
            http.close()
