"""The real end-to-end path through the API, using the assisted builder."""

from tests.conftest import confirm_sofa, photo_bytes, upload_photos, wait_for_status

ANSWERS = {"room_width_m": 4.0, "room_depth_m": 3.0, "dimensions_measured": True}


def _ready_session(client, session):
    confirm_sofa(client, session)
    upload_photos(client, session)
    url = f"/api/sessions/{session['id']}"
    assert client.post(f"{url}/check", headers=session["headers"]).status_code == 200
    assert client.put(f"{url}/answers", json=ANSWERS, headers=session["headers"]).status_code == 200
    assert client.post(f"{url}/build", headers=session["headers"]).status_code == 202
    return wait_for_status(client, session, ("ready", "failed"))


def test_full_session_builds_a_labelled_assisted_scene(client, session):
    body = _ready_session(client, session)
    assert body["status"] == "ready", body["error"]
    scene = body["scene"]
    assert scene["provenance"]["method"] == "assisted"
    assert scene["calibration"]["status"] == "calibrated"
    assert scene["furniture"]["dimensions"] == [2.0, 0.85, 0.9]
    assert scene["furniture"]["is_proxy"] is True
    assert len(scene["source_photos"]) == 3

    for name in (scene["assets"]["room"], scene["assets"]["furniture"]):
        asset = client.get(
            f"/api/sessions/{session['id']}/assets/{name}", headers=session["headers"]
        )
        assert asset.status_code == 200
        assert asset.content[:4] == b"glTF"


def test_estimated_room_is_labelled_estimated(client, session):
    confirm_sofa(client, session)
    url = f"/api/sessions/{session['id']}"
    client.put(
        f"{url}/answers", json={**ANSWERS, "dimensions_measured": False}, headers=session["headers"]
    )
    client.post(f"{url}/build", headers=session["headers"])
    body = wait_for_status(client, session, ("ready", "failed"))
    assert body["scene"]["calibration"]["status"] == "estimated"
    assert body["scene"]["warnings"]


def test_layout_round_trips_without_changing_geometry(client, session):
    before = _ready_session(client, session)
    url = f"/api/sessions/{session['id']}"
    saved = client.put(
        f"{url}/layout", json={"position": [1.5, 1.2], "yaw": 0.75}, headers=session["headers"]
    )
    assert saved.status_code == 200
    after = client.get(url, headers=session["headers"]).json()
    assert after["placement"] == {"position": [1.5, 1.2], "yaw": 0.75}
    assert after["scene"] == before["scene"]


def test_failed_build_keeps_inputs_and_can_retry(client, session, monkeypatch):
    from app.services import pipeline

    def explode(*_args, **_kwargs):
        raise RuntimeError("boom with private detail")

    confirm_sofa(client, session)
    url = f"/api/sessions/{session['id']}"
    client.put(f"{url}/answers", json=ANSWERS, headers=session["headers"])

    monkeypatch.setattr(pipeline, "compose_scene", explode)
    client.post(f"{url}/build", headers=session["headers"])
    failed = wait_for_status(client, session, ("failed",))
    assert "private detail" not in failed["error"]["message"]
    assert failed["answers"]["room_width_m"] == 4.0

    monkeypatch.undo()
    assert client.post(f"{url}/build", headers=session["headers"]).status_code == 202
    assert wait_for_status(client, session, ("ready",))["status"] == "ready"


def test_second_build_while_running_is_refused(client, session):
    from app.services.pipeline import claim_build

    confirm_sofa(client, session)
    url = f"/api/sessions/{session['id']}"
    client.put(f"{url}/answers", json=ANSWERS, headers=session["headers"])
    assert claim_build(session["id"]) is True
    assert claim_build(session["id"]) is False
    assert client.post(f"{url}/build", headers=session["headers"]).status_code == 409


def test_check_requires_confirmed_product_and_enough_photos(client, session):
    url = f"/api/sessions/{session['id']}"
    assert client.post(f"{url}/check", headers=session["headers"]).status_code == 409
    confirm_sofa(client, session)
    assert client.post(f"{url}/check", headers=session["headers"]).json()["error"]["code"] == (
        "too_few_photos"
    )


def test_seventh_photo_is_refused(client, session):
    upload_photos(client, session, count=6)
    response = client.post(
        f"/api/sessions/{session['id']}/photos",
        files={"file": ("p.jpg", photo_bytes(99), "image/jpeg")},
        headers=session["headers"],
    )
    assert response.status_code == 409


def test_sample_is_labelled_as_a_sample(client):
    body = client.post("/api/sessions/sample").json()["session"]
    assert body["status"] == "ready"
    assert body["scene"]["provenance"]["method"] == "sample"
    assert body["scene"]["source_photos"] == []


def test_render_without_key_reports_not_configured(client):
    created = client.post("/api/sessions/sample").json()
    response = client.post(
        f"/api/sessions/{created['session']['id']}/renders",
        data={"style_prompt": "warm japandi"},
        files={"snapshot": ("s.jpg", photo_bytes(5), "image/jpeg")},
        headers={"Authorization": f"Bearer {created['token']}"},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "image_not_configured"
