"""Muse Spark Open on Baseten: interpretation only, always schema-validated.

The model always reasons, so a small max_tokens leaves `content` empty. Keep the budget large.
"""

import base64
import json
import logging
import re
import time
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core import budget
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


_shared: httpx.Client | None = None


def _client() -> httpx.Client:
    """One kept-alive connection, so each call skips a fresh TLS handshake."""
    global _shared
    if _shared is None:
        _shared = httpx.Client(timeout=get_settings().provider_timeout_s)
    return _shared


def warm() -> None:
    """Opens the connection ahead of a call. Listing models is free."""
    settings = get_settings()
    if not settings.spark_enabled:
        return
    try:
        _client().get(
            f"{settings.baseten_base_url}/models",
            headers={"Authorization": f"Bearer {settings.baseten_api}"},
        )
    except httpx.HTTPError:
        log.warning("spark warm-up failed")


def chat_json(
    system: str,
    user_content: list[dict],
    schema: type[T],
    max_tokens: int = 4000,
    client: httpx.Client | None = None,
    reasoning_effort: str | None = None,
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
    if reasoning_effort:
        # Muse Spark always reasons; "minimal" keeps short answers quick.
        payload["reasoning_effort"] = reasoning_effort
    headers = {"Authorization": f"Bearer {settings.baseten_api}"}
    ticket = budget.reserve("spark", budget.spark_reserve(max_tokens))
    http = client or _client()
    started = time.monotonic()
    try:
        url = f"{settings.baseten_base_url}/chat/completions"
        try:
            response = http.post(url, json=payload, headers=headers)
        except httpx.ConnectError:
            # The connection never opened, so nothing was sent or billed: one retry is safe.
            log.warning("spark connection failed, retrying")
            response = http.post(url, json=payload, headers=headers)
        response.raise_for_status()
        body = response.json()
        usage = body.get("usage") or {}
        details = usage.get("completion_tokens_details") or {}
        log.info(
            "spark answered",
            extra={
                "fields": {
                    "ms": round((time.monotonic() - started) * 1000),
                    "tokens_in": usage.get("prompt_tokens"),
                    "tokens_out": usage.get("completion_tokens"),
                    "reasoning_tokens": details.get("reasoning_tokens"),
                    "effort": reasoning_effort,
                }
            },
        )
        budget.settle(ticket, budget.spark_cost(body.get("usage")))
        content = body["choices"][0]["message"]["content"]
        if not content:
            raise ValueError("empty content")
        return schema.model_validate(parse_json_reply(content))
    except (httpx.HTTPError, KeyError, IndexError, ValueError, ValidationError) as exc:
        log.warning("spark call failed", extra={"fields": {"error_type": type(exc).__name__}})
        raise ProviderUnavailable(
            "spark_failed", "AI reading did not finish. You can enter the details yourself."
        ) from exc
