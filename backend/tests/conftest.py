"""Tests use a temporary SQLite file and folder, with all provider keys blank."""

import io
import os
import tempfile
import time

_root = tempfile.mkdtemp(prefix="roomset-test-")
os.environ.update(
    ROOMSET_ENV="test",
    DATABASE_URL=f"sqlite:///{_root}/test.db",
    STORAGE_BACKEND="local",
    LOCAL_STORAGE_DIR=f"{_root}/artifacts",
    BASETEN_API="",
    MUSE_API="",
    SCENE_BUILDER="local",
    FRONTEND_DIST=f"{_root}/no-dist",
    MAX_SESSIONS_PER_MINUTE="1000",
    MAX_REQUESTS_PER_MINUTE="100000",
)

import numpy as np  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.db.engine import get_engine  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.create_all(get_engine())


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def session(client):
    created = client.post("/api/sessions").json()
    return {
        "id": created["session"]["id"],
        "headers": {"Authorization": f"Bearer {created['token']}"},
    }


def photo_bytes(seed: int = 1, brightness: float = 1.0) -> bytes:
    """A detailed, seed-dependent image that passes blur checks."""
    rng = np.random.default_rng(seed)
    blocks = rng.integers(0, 255, (24, 32, 3), dtype=np.uint8)
    image = Image.fromarray(blocks).resize((640, 480), Image.NEAREST)
    array = (np.asarray(image, dtype=np.float32) * brightness).astype(np.uint8)
    out = io.BytesIO()
    Image.fromarray(array).save(out, "JPEG", quality=90)
    return out.getvalue()


def wait_for_status(client, session, statuses, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        body = client.get(f"/api/sessions/{session['id']}", headers=session["headers"]).json()
        if body["status"] in statuses:
            return body
        time.sleep(0.05)
    raise AssertionError(f"timed out, last status {body['status']}")


def confirm_sofa(client, session, width=2.0, depth=0.9, height=0.85):
    response = client.put(
        f"/api/sessions/{session['id']}/product",
        json={"name": "Test sofa", "width_m": width, "depth_m": depth, "height_m": height},
        headers=session["headers"],
    )
    assert response.status_code == 200, response.text


def upload_photos(client, session, count=3):
    for seed in range(count):
        response = client.post(
            f"/api/sessions/{session['id']}/photos",
            files={"file": ("p.jpg", photo_bytes(seed + 1), "image/jpeg")},
            headers=session["headers"],
        )
        assert response.status_code == 201, response.text
