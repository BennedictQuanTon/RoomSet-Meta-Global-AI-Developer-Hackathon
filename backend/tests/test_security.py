"""Session isolation, upload safety, and the SSRF guard."""

import io

import httpx
import pytest
from PIL import Image

from app.services.url_guard import FetchFailed, UrlBlocked, fetch_public, is_public
from tests.conftest import photo_bytes, upload_photos


def test_one_session_cannot_read_another(client, session):
    upload_photos(client, session, count=1)
    photo_id = client.get(f"/api/sessions/{session['id']}", headers=session["headers"]).json()[
        "photos"
    ][0]["id"]
    other = client.post("/api/sessions").json()
    stolen = {"Authorization": f"Bearer {other['token']}"}
    base = f"/api/sessions/{session['id']}"
    assert client.get(base, headers=stolen).status_code == 404
    assert client.get(f"{base}/photos/{photo_id}", headers=stolen).status_code == 404
    assert client.get(f"{base}/assets/room.glb", headers=stolen).status_code == 404
    assert client.delete(base, headers=stolen).status_code == 404
    assert client.get(base).status_code == 404


def test_asset_names_are_allow_listed(client, session):
    base = f"/api/sessions/{session['id']}/assets"
    assert client.get(f"{base}/secrets.txt", headers=session["headers"]).status_code == 404


def test_upload_strips_gps_metadata(client, session):
    exif = Image.Exif()
    exif[0x010F] = "SecretCameraMaker"
    raw = io.BytesIO()
    Image.open(io.BytesIO(photo_bytes())).save(raw, "JPEG", exif=exif)
    assert b"SecretCameraMaker" in raw.getvalue()

    base = f"/api/sessions/{session['id']}/photos"
    photo = client.post(
        base, files={"file": ("p.jpg", raw.getvalue(), "image/jpeg")}, headers=session["headers"]
    ).json()
    stored = client.get(f"{base}/{photo['id']}", headers=session["headers"]).content
    assert b"SecretCameraMaker" not in stored


@pytest.mark.parametrize("payload", [b"not an image", b"<svg xmlns='x'/>"])
def test_non_images_fail_safely(client, session, payload):
    response = client.post(
        f"/api/sessions/{session['id']}/photos",
        files={"file": ("p.jpg", payload, "image/jpeg")},
        headers=session["headers"],
    )
    assert response.status_code == 415


def test_oversized_upload_is_refused(client, session):
    response = client.post(
        f"/api/sessions/{session['id']}/photos",
        files={"file": ("p.jpg", b"x" * (13 * 1024 * 1024), "image/jpeg")},
        headers=session["headers"],
    )
    assert response.status_code == 413


def test_dark_and_duplicate_photos_are_flagged(client, session):
    base = f"/api/sessions/{session['id']}/photos"
    send = lambda data: client.post(  # noqa: E731
        base, files={"file": ("p.jpg", data, "image/jpeg")}, headers=session["headers"]
    ).json()
    first = send(photo_bytes(7))
    assert first["quality"]["flags"] == []
    second = send(photo_bytes(7))
    assert "duplicate" in second["quality"]["flags"]
    assert second["quality"]["duplicate_of"] == first["id"]
    assert "too_dark" in send(photo_bytes(8, brightness=0.05))["quality"]["flags"]


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "::1",
        "fd00::1",
        "::ffff:127.0.0.1",
        "100.64.0.1",
    ],
)
def test_private_addresses_are_not_public(address):
    assert not is_public(address)


def _no_network(_request):
    raise AssertionError("should not connect")


def test_private_target_never_connects():
    with pytest.raises(UrlBlocked):
        fetch_public(
            "https://metadata.example/",
            resolver=lambda _h: ["169.254.169.254"],
            transport=httpx.MockTransport(_no_network),
        )


def test_mixed_public_and_private_dns_is_blocked():
    with pytest.raises(UrlBlocked):
        fetch_public(
            "https://rebind.example/",
            resolver=lambda _h: ["93.184.216.34", "10.0.0.5"],
            transport=httpx.MockTransport(_no_network),
        )


def test_http_scheme_and_custom_port_are_blocked():
    for url in ("http://shop.example/", "https://shop.example:8443/", "https://u:p@shop.example/"):
        with pytest.raises(UrlBlocked):
            fetch_public(url, resolver=lambda _h: ["93.184.216.34"])


def test_redirect_to_private_address_is_blocked():
    resolver = {"shop.example": ["93.184.216.34"], "internal.example": ["10.0.0.5"]}
    transport = httpx.MockTransport(
        lambda _req: httpx.Response(302, headers={"location": "https://internal.example/admin"})
    )
    with pytest.raises(UrlBlocked):
        fetch_public("https://shop.example/", resolver=resolver.__getitem__, transport=transport)


def test_connection_is_pinned_to_the_checked_ip():
    seen = {}

    def handler(request):
        seen.update(host=request.url.host, header=request.headers["host"])
        seen["sni"] = request.extensions.get("sni_hostname")
        return httpx.Response(200, text="<html></html>", headers={"content-type": "text/html"})

    result = fetch_public(
        "https://shop.example/sofa?x=1",
        resolver=lambda _h: ["93.184.216.34"],
        transport=httpx.MockTransport(handler),
    )
    assert seen == {"host": "93.184.216.34", "header": "shop.example", "sni": "shop.example"}
    assert result.url == "https://shop.example/sofa?x=1"


def test_oversized_page_is_refused():
    big = b"x" * (4 * 1024 * 1024)
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, content=big))
    with pytest.raises(FetchFailed):
        fetch_public(
            "https://shop.example/", resolver=lambda _h: ["93.184.216.34"], transport=transport
        )
