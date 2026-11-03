"""Cheap, deterministic photo checks. They catch bad input, not geometric overlap."""

import numpy as np
from PIL import Image

from app.domain.capture import PhotoFlag, PhotoQuality

BLUR_MIN = 25.0
BRIGHTNESS_MIN = 35.0
DUPLICATE_MAX_BITS = 4


def _gray(image: Image.Image, size: tuple[int, int]) -> np.ndarray:
    return np.asarray(image.convert("L").resize(size), dtype=np.float32)


def blur_score(image: Image.Image) -> float:
    """Variance of a Laplacian at fixed scale. Low means little edge detail."""
    g = _gray(image, (512, 512))
    laplacian = g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:] - 4 * g[1:-1, 1:-1]
    return float(laplacian.var())


def dhash(image: Image.Image) -> str:
    g = _gray(image, (9, 8))
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return f"{int(''.join('1' if b else '0' for b in bits), 2):016x}"


def hash_distance(a: str, b: str) -> int:
    return (int(a, 16) ^ int(b, 16)).bit_count()


def assess(image: Image.Image, existing: dict[str, str]) -> PhotoQuality:
    """`existing` maps photo id to dhash for the session's other photos."""
    score = blur_score(image)
    brightness = float(_gray(image, (64, 64)).mean())
    digest = dhash(image)
    flags: list[PhotoFlag] = []
    if score < BLUR_MIN:
        flags.append("blurry")
    if brightness < BRIGHTNESS_MIN:
        flags.append("too_dark")
    duplicate_of = next(
        (
            pid
            for pid, other in existing.items()
            if hash_distance(digest, other) <= DUPLICATE_MAX_BITS
        ),
        None,
    )
    if duplicate_of:
        flags.append("duplicate")
    return PhotoQuality(
        blur_score=round(score, 1),
        brightness=round(brightness, 1),
        dhash=digest,
        flags=flags,
        duplicate_of=duplicate_of,
    )
