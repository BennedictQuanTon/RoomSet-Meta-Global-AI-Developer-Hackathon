"""The spending cap: refuses before an over-budget call, keeps real costs, survives restarts."""

import json

import httpx
import pytest
from pydantic import BaseModel

from app.core import budget
from app.core.config import get_settings
from app.core.errors import AppError
from app.providers import baseten


class Answer(BaseModel):
    ok: bool


@pytest.fixture()
def ledger(monkeypatch, tmp_path):
    settings = get_settings()
    monkeypatch.setattr(settings, "budget_file", str(tmp_path / "spend.json"))
    monkeypatch.setattr(settings, "spend_limit_usd", 0.5)
    monkeypatch.setattr(settings, "baseten_api", "k")
    return tmp_path / "spend.json"


def spark_client(usage):
    def handler(request):
        body = {"choices": [{"message": {"content": json.dumps({"ok": True})}}]}
        if usage is not None:
            body["usage"] = usage
        return httpx.Response(200, json=body)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_actual_token_cost_replaces_the_estimate(ledger):
    baseten.chat_json(
        "s",
        [],
        Answer,
        max_tokens=4000,
        client=spark_client({"prompt_tokens": 1000, "completion_tokens": 500}),
    )
    status = budget.status()
    assert status["total_usd"] == pytest.approx((1000 * 3 + 500 * 10) / 1e6)
    assert status["calls"]["spark"] == 1


def test_unknown_usage_keeps_the_cautious_estimate(ledger):
    baseten.chat_json("s", [], Answer, max_tokens=4000, client=spark_client(None))
    assert budget.status()["total_usd"] == pytest.approx(budget.spark_reserve(4000))


def test_refuses_before_calling_when_the_cap_would_be_passed(ledger, monkeypatch):
    monkeypatch.setattr(get_settings(), "spend_limit_usd", 0.05)
    called = []

    def handler(request):
        called.append(1)
        return httpx.Response(200, json={})

    with pytest.raises(AppError) as error:
        baseten.chat_json(
            "s",
            [],
            Answer,
            max_tokens=4000,
            client=httpx.Client(transport=httpx.MockTransport(handler)),
        )
    assert error.value.code == "ai_budget_spent"
    assert called == []


def test_daily_call_limit(ledger, monkeypatch):
    monkeypatch.setattr(get_settings(), "daily_image_calls", 2)
    budget.reserve("image", 0.01)
    budget.reserve("image", 0.01)
    with pytest.raises(AppError) as error:
        budget.reserve("image", 0.01)
    assert error.value.code == "daily_ai_limit"


def test_the_ledger_survives_a_restart(ledger):
    budget.reserve("speech", 0.2)
    saved = json.loads(ledger.read_text())
    assert saved["total_usd"] == pytest.approx(0.2)
    assert budget.status()["left_usd"] == pytest.approx(0.3)
