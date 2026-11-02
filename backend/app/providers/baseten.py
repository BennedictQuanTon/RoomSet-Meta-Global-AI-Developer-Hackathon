"""Muse Spark Open on Baseten: interpretation only, always schema-validated.

The model always reasons, so a small max_tokens leaves `content` empty. Keep the budget large.
"""

import base64
import json
import logging
import re
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.core.errors import ProviderUnavailable

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


def image_part(jpeg: bytes, media_type: str = "image/jpeg") -> dict:
    encoded = base64.b64encode(jpeg).decode()
    return {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{encoded}"}}


def parse_json_reply(text: str) -> dict:
    """Accepts bare JSON or a fenced block."""
    fenced = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    candidate = fenced.group(1) if fenced else text[text.find("{") : text.rfind("}") + 1]
    return json.loads(candidate)


def chat_json(
    system: str,
    user_content: list[dict],
    schema: type[T],
    max_tokens: int = 4000,
    client: httpx.Client | None = None,
) -> T:
    settings = get_settings()
    if not settings.spark_enabled:
        raise ProviderUnavailable("spark_not_configured", "AI reading is not configured.")

    payload = {
        "model": settings.baseten_model,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
    }
    headers = {"Authorization": f"Bearer {settings.baseten_api}"}
    http = client or httpx.Client(timeout=settings.provider_timeout_s)
    try:
        response = http.post(
            f"{settings.baseten_base_url}/chat/completions", json=payload, headers=headers
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if not content:
            raise ValueError("empty content")
        return schema.model_validate(parse_json_reply(content))
    except (httpx.HTTPError, KeyError, IndexError, ValueError, ValidationError) as exc:
        log.warning("spark call failed", extra={"fields": {"error_type": type(exc).__name__}})
        raise ProviderUnavailable(
            "spark_failed", "AI reading did not finish. You can enter the details yourself."
        ) from exc
    finally:
        if client is None:
            http.close()
