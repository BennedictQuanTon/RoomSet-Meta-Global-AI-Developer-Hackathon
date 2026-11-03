"""Listing parsing, provider handling, and the rule against inventing dimensions."""

import json

import httpx
import pytest

from app.core.config import get_settings
from app.core.errors import ProviderUnavailable
from app.domain.capture import PhotoQuality
from app.providers import baseten, muse_image
from app.services import product_intake
from app.services.product_intake import parse_dimensions, parse_listing_html


def test_labelled_dimensions_convert_to_meters():
    found = parse_dimensions("Overall width: 210 cm, Depth 92cm. Height: 33 in")
    assert found["width"].value_m == 2.1
    assert found["depth"].value_m == 0.92
    assert found["height"].value_m == pytest.approx(0.838, abs=0.001)
    assert found["width"].confidence == "medium"


def test_unlabelled_triple_is_only_low_confidence():
    found = parse_dimensions("Size 210 x 92 x 84 cm")
    assert {f.confidence for f in found.values()} == {"low"}


def test_page_without_dimensions_stays_missing():
    html = b"<html><head><title>Lovely sofa</title></head><body>So comfy!</body></html>"
    draft, _ = parse_listing_html(html)
    assert draft.name == "Lovely sofa"
    assert draft.width.value_m is None
    assert draft.width.source == "missing"


def test_json_ld_product_name_and_images():
    ld = {
        "@type": "Product",
        "name": "Oslo Sofa",
        "image": ["https://cdn.shop/a.jpg", "http://x/b.jpg"],
    }
    html = f'<script type="application/ld+json">{json.dumps(ld)}</script>'.encode()
    draft, _ = parse_listing_html(html)
    assert draft.name == "Oslo Sofa"
    assert draft.image_urls == ["https://cdn.shop/a.jpg"]


def test_listing_still_works_without_ai(monkeypatch):
    class Fetched:
        body = b"<html><title>Sofa</title><p>Width: 200 cm</p></html>"

    monkeypatch.setattr(product_intake, "fetch_public", lambda _url: Fetched())
    draft = product_intake.read_listing("https://shop.example/sofa")
    assert draft.width.value_m == 2.0
    assert draft.depth.value_m is None
    assert any("spark_not_configured" in note for note in draft.notes)


def _spark_client(content):
    def handler(request):
        assert request.headers["authorization"] == "Bearer k"
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    return httpx.Client(transport=httpx.MockTransport(handler))


@pytest.fixture()
def spark_key(monkeypatch):
    monkeypatch.setattr(get_settings(), "baseten_api", "k")
    monkeypatch.setattr(get_settings(), "muse_api", "k")


def test_spark_reply_is_schema_validated(spark_key):
    reply = '```json\n{"blur_score": 1, "brightness": 2, "dhash": "ab"}\n```'
    result = baseten.chat_json("s", [], PhotoQuality, client=_spark_client(reply))
    assert result.dhash == "ab"

    with pytest.raises(ProviderUnavailable):
        baseten.chat_json("s", [], PhotoQuality, client=_spark_client('{"nope": true}'))


def test_null_content_from_reasoning_is_a_clean_failure(spark_key):
    with pytest.raises(ProviderUnavailable):
        baseten.chat_json("s", [], PhotoQuality, client=_spark_client(None))


def test_muse_image_request_matches_the_documented_shape(spark_key):
    captured = {}

    def handler(request):
        captured.update(json.loads(request.content), path=request.url.path)
        return httpx.Response(200, json={"data": [{"b64_json": "aGVsbG8="}]})

    image = muse_image.edit_image(
        "p", [(b"x", "image/jpeg")], client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    assert image == b"hello"
    assert captured["path"] == "/v1/images/edits"
    assert captured["n"] == 1
    assert captured["reasoning_strength"] == "low"
    assert "mask" not in captured
    assert captured["images"][0]["image_url"].startswith("data:image/jpeg;base64,")
