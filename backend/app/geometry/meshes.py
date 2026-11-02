"""Small mesh helpers shared by the room and sofa builders."""

import io

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals


def _linear(channel: int) -> float:
    value = channel / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def material(hex_color: str, roughness: float = 0.85) -> PBRMaterial:
    """glTF base color factors are linear, while brand colors are sRGB."""
    rgb = [int(hex_color[i : i + 2], 16) for i in (1, 3, 5)]
    return PBRMaterial(
        baseColorFactor=[*(_linear(c) for c in rgb), 1.0],
        roughnessFactor=roughness,
        metallicFactor=0.0,
    )


def box(
    size: tuple[float, float, float],
    center: tuple[float, float, float],
    color: str,
    yaw: float = 0.0,
) -> trimesh.Trimesh:
    transform = trimesh.transformations.rotation_matrix(yaw, [0, 1, 0])
    transform[:3, 3] = center
    mesh = trimesh.creation.box(extents=size, transform=transform)
    mesh.visual = TextureVisuals(material=material(color))
    return mesh


def export_glb(parts: dict[str, trimesh.Trimesh]) -> bytes:
    """Geometry stays in world units and every node transform stays identity."""
    scene = trimesh.Scene()
    for name, mesh in parts.items():
        scene.add_geometry(mesh, node_name=name, geom_name=name, transform=np.eye(4))
    buffer = io.BytesIO()
    scene.export(buffer, file_type="glb")
    return buffer.getvalue()
