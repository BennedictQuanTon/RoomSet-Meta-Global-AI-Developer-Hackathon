"""AssemblyAI speech to text for short voice questions. Audio is deleted from AssemblyAI after use.

API as documented on 3 Nov 2026: upload raw bytes to /v2/upload, submit the returned URL to
/v2/transcript, then poll /v2/transcript/{id} until status is completed or error.
"""

import logging
import time
from dataclasses import dataclass

import httpx

from app.core import budget
from app.core.config import get_settings
from app.core.errors import ProviderUnavailable

log = logging.getLogger(__name__)

POLL_S = 0.3
# Universal-3.5 Pro first; detection falls back to Universal-2, which lists Vietnamese.
SPEECH_MODELS = ["universal-3-5-pro", "universal-2"]


_shared: httpx.Client | None = None


def _client() -> httpx.Client:
    """One kept-alive connection: a fresh TLS handshake from Vietnam costs about a second."""
    global _shared
    if _shared is None:
        _shared = httpx.Client(timeout=30.0)
    return _shared


def warm() -> None:
    """Opens the connection before the person finishes speaking. Listing transcripts is free."""
    settings = get_settings()
    if not settings.assemblyai_api:
        return
    try:
        _client().get(
            f"{settings.assemblyai_base_url}/v2/transcript",
            params={"limit": 1},
            headers={"authorization": settings.assemblyai_api},
        )
    except httpx.HTTPError:
        log.warning("speech warm-up failed")


def _send(http: httpx.Client, method: str, url: str, **kwargs) -> httpx.Response:
    """Retries once when the connection could not even open, so nothing was sent or billed."""
    try:
        return http.request(method, url, **kwargs)
    except httpx.ConnectError:
        log.warning("speech connection failed, retrying")
        return http.request(method, url, **kwargs)


@dataclass
class Transcript:
    text: str
    language: str | None
    upload_ms: int = 0
    wait_ms: int = 0


def transcribe(audio: bytes, client: httpx.Client | None = None) -> Transcript:
    settings = get_settings()
    if not settings.assemblyai_api:
        raise ProviderUnavailable(
            "speech_not_configured", "Voice questions are not switched on yet."
        )
    headers = {"authorization": settings.assemblyai_api}
    base = settings.assemblyai_base_url
    budget.reserve("speech", budget.SPEECH_PER_CALL)
    http = client or _client()
    transcript_id = None
    started = time.monotonic()
    try:
        upload = _send(
            http,
            "POST",
            f"{base}/v2/upload",
            content=audio,
            headers={**headers, "content-type": "application/octet-stream"},
        )
        upload.raise_for_status()
        uploaded = time.monotonic()
        submitted = _send(
            http,
            "POST",
            f"{base}/v2/transcript",
            json={
                "audio_url": upload.json()["upload_url"],
                "speech_models": SPEECH_MODELS,
                "language_detection": True,
            },
            headers=headers,
        )
        submitted.raise_for_status()
        transcript_id = submitted.json()["id"]
        deadline = time.monotonic() + settings.speech_timeout_s
        while True:
            result = _send(http, "GET", f"{base}/v2/transcript/{transcript_id}", headers=headers)
            result.raise_for_status()
            body = result.json()
            if body["status"] == "completed":
                return Transcript(
                    (body.get("text") or "").strip(),
                    body.get("language_code"),
                    round((uploaded - started) * 1000),
                    round((time.monotonic() - uploaded) * 1000),
                )
            if body["status"] == "error":
                raise ValueError("transcription error")
            if time.monotonic() > deadline:
                raise TimeoutError("transcription timed out")
            time.sleep(POLL_S)
    except (httpx.HTTPError, KeyError, ValueError, TimeoutError) as exc:
        log.warning("speech call failed", extra={"fields": {"error_type": type(exc).__name__}})
        raise ProviderUnavailable(
            "speech_failed", "We couldn't hear that. Try again, a little closer to the phone."
        ) from exc
    finally:
        if transcript_id:
            try:
                http.delete(f"{base}/v2/transcript/{transcript_id}", headers=headers)
            except httpx.HTTPError:
                log.warning("speech delete failed")
