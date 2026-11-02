"""Photo quality evidence. Flags are specific so the UI can say exactly what to retake."""

from typing import Literal

from pydantic import BaseModel

PhotoFlag = Literal["blurry", "too_dark", "duplicate"]


class PhotoQuality(BaseModel):
    blur_score: float
    brightness: float
    dhash: str
    flags: list[PhotoFlag] = []
    duplicate_of: str | None = None


class PhotoView(BaseModel):
    id: str
    width: int
    height: int
    quality: PhotoQuality


class CoverageReport(BaseModel):
    """`overlap` stays not_measured until image matching or reconstruction provides evidence."""

    overlap: Literal["not_measured", "measured_ok", "measured_weak"] = "not_measured"
    semantic_same_area: bool | None = None
    retake_instructions: list[str] = []
