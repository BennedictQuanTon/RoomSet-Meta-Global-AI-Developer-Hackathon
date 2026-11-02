"""Parameterized sofa whose outer box exactly matches the confirmed dimensions.

Local X width, Y height, Z depth; pivot at base center on the floor; back toward -Z.
It is a dimensioned proxy: size is real, shape and materials are approximate.
"""

from app.geometry.meshes import box, export_glb

BODY = "#C66B48"
CUSHION = "#D27F5E"


def build_sofa_glb(width: float, height: float, depth: float) -> bytes:
    arm = min(0.14 * width, 0.2)
    back = min(0.24 * depth, 0.24)
    seat_top = min(0.45, 0.58 * height)
    base_top = seat_top * 0.55
    arm_top = min(height, seat_top + 0.2)

    inner_width = width - 2 * arm
    seat_depth = depth - back
    seat_z = -depth / 2 + back + seat_depth / 2
    gap = min(0.012, inner_width * 0.01)

    parts = {
        "base": box((width, base_top, depth), (0, base_top / 2, 0), BODY),
        "back": box((width, height, back), (0, height / 2, -depth / 2 + back / 2), BODY),
        "arm_left": box((arm, arm_top, depth), (-width / 2 + arm / 2, arm_top / 2, 0), BODY),
        "arm_right": box((arm, arm_top, depth), (width / 2 - arm / 2, arm_top / 2, 0), BODY),
    }
    cushions = max(2, min(3, round(inner_width / 0.6)))
    cushion_width = (inner_width - gap * (cushions - 1)) / cushions
    cushion_height = seat_top - base_top
    for index in range(cushions):
        x = -inner_width / 2 + cushion_width / 2 + index * (cushion_width + gap)
        parts[f"seat_{index}"] = box(
            (cushion_width, cushion_height, seat_depth),
            (x, base_top + cushion_height / 2, seat_z),
            CUSHION,
        )
    return export_glb(parts)
