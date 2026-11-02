"""Decides what to ask. Rules cover what geometry needs; Spark may add specific questions."""

import io
import logging

from PIL import Image
from pydantic import BaseModel, Field

from app.core.errors import ProviderUnavailable
from app.domain.capture import CoverageReport
from app.domain.clarification import Clarification
from app.providers import baseten

log = logging.getLogger(__name__)

RETAKE = {
    "blurry": "Hold still and take another photo with the same corner in view.",
    "too_dark": "Turn on a light and take another photo with the same corner in view.",
    "duplicate": "This matches another photo. Take a few steps sideways and retake it.",
}

SPARK_SYSTEM = """You look at phone photos of one room corner where someone may place a sofa.
Do not estimate measurements. Return one JSON object only, with keys:
same_area (boolean: do the photos show the same area?),
questions (at most 2 short strings about what is unclear: boundaries, obstacles such as radiators
or doors that could limit placement, or intended sofa orientation).
"""


class SparkPhotoRead(BaseModel):
    same_area: bool
    questions: list[str] = Field(default=[], max_length=2)


def rule_questions() -> list[Clarification]:
    return [
        Clarification(
            id="room_width_m",
            question="How long is wall A, the wall the sofa's back would sit against?",
            help="Use the usable length, corner to corner or corner to door.",
            answer_type="number",
            unit="m",
            affected_field="floor",
            blocking=True,
        ),
        Clarification(
            id="room_depth_m",
            question="How long is wall B, the other wall that meets it at the corner?",
            answer_type="number",
            unit="m",
            affected_field="floor",
            blocking=True,
        ),
        Clarification(
            id="dimensions_measured",
            question="Did you measure these with a tape?",
            help="If not, your room is labelled as an estimate and clearances stay approximate.",
            answer_type="boolean",
            affected_field="calibration",
            blocking=True,
        ),
        Clarification(
            id="ceiling_height_m",
            question="How high is the ceiling?",
            help="Optional. Only changes how tall walls look.",
            answer_type="number",
            unit="m",
            affected_field="walls",
            blocking=False,
        ),
        Clarification(
            id="obstacles",
            question="Anything fixed in this corner, such as a radiator or a door swing?",
            help="Optional. Overlap checks only know what you add here.",
            answer_type="obstacles",
            affected_field="obstacles",
            blocking=False,
        ),
    ]


def _downscale(jpeg: bytes, edge: int = 768) -> bytes:
    image = Image.open(io.BytesIO(jpeg))
    image.thumbnail((edge, edge))
    out = io.BytesIO()
    image.save(out, "JPEG", quality=80)
    return out.getvalue()


def review_photos(
    photos: list[bytes], flags: list[list[str]]
) -> tuple[CoverageReport, list[Clarification]]:
    report = CoverageReport(
        retake_instructions=[RETAKE[f] for photo_flags in flags for f in photo_flags]
    )
    questions = rule_questions()
    try:
        content: list[dict] = [{"type": "text", "text": "Photos of the corner:"}]
        content += [baseten.image_part(_downscale(p)) for p in photos[:6]]
        read = baseten.chat_json(SPARK_SYSTEM, content, SparkPhotoRead)
    except ProviderUnavailable as exc:
        log.info("photo review skipped", extra={"fields": {"code": exc.code}})
        return report, questions

    report.semantic_same_area = read.same_area
    if not read.same_area:
        report.retake_instructions.append(
            "These photos may show different areas. Replace any that don't show this corner."
        )
    questions += [
        Clarification(
            id=f"ai_note_{index}",
            question=text[:200],
            answer_type="text",
            affected_field="notes",
            blocking=False,
            origin="ai",
        )
        for index, text in enumerate(read.questions)
    ]
    return report, questions
