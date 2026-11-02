"""A photoscanned sample sofa, stretched so its outer box exactly matches the confirmed dimensions.

Local X width, Y height, Z depth; pivot at base center on the floor; back toward -Z.
It is a dimensioned proxy: size is real, shape and materials are a sample (Poly Haven, CC0).
The size is baked into the vertices, so node scale stays 1.
"""

from pathlib import Path

import numpy as np
import trimesh

from app.geometry.meshes import export_glb

BASE_MODEL = Path(__file__).parent / "assets" / "sofa_base.glb"


def build_sofa_glb(width: float, height: float, depth: float) -> bytes:
    scene = trimesh.load(BASE_MODEL, file_type="glb", force="scene", process=False)
    parts: dict[str, trimesh.Trimesh] = {}
    for node in scene.graph.nodes_geometry:
        transform, geometry = scene.graph[node]
        mesh = scene.geometry[geometry].copy(include_cache=True)  # Keeps the model's own normals.
        mesh.apply_transform(transform)
        parts[node] = mesh

    low = np.min([mesh.bounds[0] for mesh in parts.values()], axis=0)
    high = np.max([mesh.bounds[1] for mesh in parts.values()], axis=0)
    scale = np.array([width, height, depth]) / (high - low)
    origin = np.array([(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2])
    for mesh in parts.values():
        # Normals scale inversely, then renormalize. Losing them would make the fabric look faceted.
        normals = mesh.vertex_normals / scale
        normals /= np.linalg.norm(normals, axis=1, keepdims=True)
        mesh.vertices = (mesh.vertices - origin) * scale
        mesh.vertex_normals = normals
    return export_glb(parts, include_normals=True)
