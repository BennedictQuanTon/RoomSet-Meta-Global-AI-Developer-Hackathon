"""Product contract. Every dimension keeps where it came from and whether a person confirmed it."""

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

FieldSource = Literal["listing_data", "listing_ai", "screenshot_ai", "user", "missing"]
Confidence = Literal["high", "medium", "low"]


class MeasuredField(BaseModel):
    value_m: float | None = None
    source: FieldSource = "missing"
    confidence: Confidence | None = None


class ProductDraft(BaseModel):
    """What we could read. Never used to build geometry until confirmed."""

    source_url: str | None = None
    name: str | None = None
    category: Literal["sofa"] = "sofa"
    width: MeasuredField = MeasuredField()
    depth: MeasuredField = MeasuredField()
    height: MeasuredField = MeasuredField()
    image_urls: list[str] = []
    appearance: str | None = None
    notes: list[str] = []


class ProductConfirm(BaseModel):
    source_url: HttpUrl | None = None
    name: str = Field(min_length=1, max_length=200)
    width_m: float = Field(gt=0.3, lt=6.0)
    depth_m: float = Field(gt=0.3, lt=4.0)
    height_m: float = Field(gt=0.2, lt=2.5)
    image_urls: list[HttpUrl] = Field(default=[], max_length=8)
    appearance: str | None = Field(default=None, max_length=300)


class Product(ProductDraft):
    confirmed: bool = False


class ProductUrlIn(BaseModel):
    url: HttpUrl
