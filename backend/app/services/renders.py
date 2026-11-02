"""Optional style preview: the person's 3D view restyled by Muse Image.

This is how a request like "warm japandi, oak floor" becomes an image. It is decoration, separate
from the geometry: the editor's dimensions and clearances never come from this output.
"""

from app.providers import muse_image

PROMPT = """Restyle this 3D room planning view into a realistic interior photo.
Keep the camera angle, the room's layout, and the sofa's exact position, size and proportions.
Do not add, remove or move walls or large furniture.
Sofa: {sofa}.
Requested style, as decoration only: {style}"""


def build_prompt(style: str, sofa: str) -> str:
    return PROMPT.format(style=" ".join(style.split()), sofa=sofa)


def render_style(snapshot_jpeg: bytes, style: str, sofa: str, room_photo: bytes | None) -> bytes:
    images = [(snapshot_jpeg, "image/jpeg")]
    if room_photo:
        images.append((room_photo, "image/jpeg"))
    return muse_image.edit_image(build_prompt(style, sofa), images)
