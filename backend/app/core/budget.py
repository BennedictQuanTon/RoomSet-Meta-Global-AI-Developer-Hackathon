"""Hard spending cap across every paid model, kept on disk so a restart never resets it.

Every paid call reserves a cautious estimate first and is refused if the total would pass the cap.
After the call the reservation is replaced by the actual cost where the provider reports usage
(Muse Spark returns token counts); otherwise the estimate stays charged. Failed calls stay charged
too, because a provider may bill a request that errors.

Prices are set above the list rates read on 3 Nov 2026, so the ledger over-counts rather than
under-counts: Muse Spark on Baseten $1.25 / $4.25 per million input / output tokens, AssemblyAI
$0.21 per audio hour, Muse Image about $0.01 per image.

Check the ledger:  .venv/bin/python -m app.core.budget
"""

import json
import os
import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import get_settings
from app.core.errors import AppError

SPARK_INPUT_PER_M = 3.0
SPARK_OUTPUT_PER_M = 10.0
SPARK_INPUT_ALLOWANCE = 20_000  # Tokens reserved for the prompt, images included.
SPEECH_PER_CALL = 0.01  # Covers a full minute at about three times the list rate.
IMAGE_PER_CALL = 0.04

_lock = threading.Lock()


@dataclass
class Ticket:
    provider: str
    reserved: float


def spark_reserve(max_tokens: int) -> float:
    return (SPARK_INPUT_ALLOWANCE * SPARK_INPUT_PER_M + max_tokens * SPARK_OUTPUT_PER_M) / 1e6


def spark_cost(usage: dict | None) -> float | None:
    if not usage:
        return None
    try:
        tokens_in = int(usage.get("prompt_tokens", 0))
        tokens_out = int(usage.get("completion_tokens", 0))
    except (TypeError, ValueError):
        return None
    return (tokens_in * SPARK_INPUT_PER_M + tokens_out * SPARK_OUTPUT_PER_M) / 1e6


def _path() -> Path:
    return Path(get_settings().budget_file)


def _today() -> str:
    return datetime.now(UTC).date().isoformat()


def _read() -> dict:
    try:
        ledger = json.loads(_path().read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        ledger = {}
    ledger.setdefault("total_usd", 0.0)
    ledger.setdefault("by_provider", {})
    ledger.setdefault("calls", {})
    ledger.setdefault("since", datetime.now(UTC).isoformat(timespec="seconds"))
    if ledger.get("day") != _today():
        ledger["day"], ledger["today"] = _today(), {}
    return ledger


def _write(ledger: dict) -> None:
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(ledger, indent=2))
    os.replace(temporary, path)


def _daily_cap(provider: str) -> int:
    settings = get_settings()
    return {
        "spark": settings.daily_spark_calls,
        "speech": settings.daily_speech_calls,
        "image": settings.daily_image_calls,
    }[provider]


def reserve(provider: str, usd: float) -> Ticket:
    """Charges an estimate up front, or refuses if the cap or today's call limit would be passed."""
    limit = get_settings().spend_limit_usd
    with _lock:
        ledger = _read()
        if ledger["today"].get(provider, 0) >= _daily_cap(provider):
            raise AppError(
                "daily_ai_limit", "Today's AI allowance is used up. It resets tomorrow (UTC).", 429
            )
        if ledger["total_usd"] + usd > limit:
            raise AppError(
                "ai_budget_spent",
                f"The ${limit:.0f} AI budget for this project is used up.",
                503,
            )
        ledger["total_usd"] = round(ledger["total_usd"] + usd, 6)
        ledger["by_provider"][provider] = round(ledger["by_provider"].get(provider, 0.0) + usd, 6)
        ledger["calls"][provider] = ledger["calls"].get(provider, 0) + 1
        ledger["today"][provider] = ledger["today"].get(provider, 0) + 1
        _write(ledger)
    return Ticket(provider, usd)


def settle(ticket: Ticket, actual: float | None) -> None:
    """Swaps the estimate for the real cost. Unknown costs keep the estimate."""
    if actual is None:
        return
    delta = actual - ticket.reserved
    with _lock:
        ledger = _read()
        ledger["total_usd"] = round(max(0.0, ledger["total_usd"] + delta), 6)
        current = ledger["by_provider"].get(ticket.provider, 0.0)
        ledger["by_provider"][ticket.provider] = round(max(0.0, current + delta), 6)
        _write(ledger)


def status() -> dict:
    with _lock:
        ledger = _read()
    limit = get_settings().spend_limit_usd
    return {
        **ledger,
        "limit_usd": limit,
        "left_usd": round(max(0.0, limit - ledger["total_usd"]), 4),
    }


if __name__ == "__main__":
    print(json.dumps(status(), indent=2))
