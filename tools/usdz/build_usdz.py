"""Builds AR Quick Look files (USDZ) from the studio's GLB models, at true size.

Run from the repo root:
    python -m venv .venv-usdz && .venv-usdz/bin/pip install -r tools/usdz/requirements.txt
    .venv-usdz/bin/python tools/usdz/build_usdz.py

Reads the catalog in frontend/src/studio/apartment.data.json and writes
frontend/public/studio/ar/<model>.usdz. Each model is turned by its catalog yawOffset,
centred on X and Z, and stood on the floor, in metres with Y up. The run fails if a
result's size drifts from the catalog size by more than SIZE_TOLERANCE.
"""

from __future__ import annotations

import io
import json
import math
import sys
import tempfile
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image
from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "frontend/src/studio/apartment.data.json"
MODELS = ROOT / "frontend/public/studio/models"
OUT = ROOT / "frontend/public/studio/ar"
MAX_TEXTURE_PX = 1024  # Phones load faster; detail is still sharp at room distance.
SIZE_TOLERANCE = 0.03


def save_texture(image: Image.Image, folder: Path, name: str, keep_alpha: bool) -> str:
    image = image.convert("RGBA" if keep_alpha else "RGB")
    if max(image.size) > MAX_TEXTURE_PX:
        image.thumbnail((MAX_TEXTURE_PX, MAX_TEXTURE_PX), Image.LANCZOS)
    file = f"{name}.png" if keep_alpha else f"{name}.jpg"
    if keep_alpha:
        image.save(folder / file, optimize=True)
    else:
        image.save(folder / file, quality=86, optimize=True)
    return file


def texture_node(stage, material_path, name, file, st, colour_space):
    shader = UsdShade.Shader.Define(stage, f"{material_path}/{name}")
    shader.CreateIdAttr("UsdUVTexture")
    shader.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(file)
    shader.CreateInput("sourceColorSpace", Sdf.ValueTypeNames.Token).Set(colour_space)
    shader.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("repeat")
    shader.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("repeat")
    shader.CreateInput("st", Sdf.ValueTypeNames.Float2).ConnectToSource(st.ConnectableAPI(), "result")
    return shader


def define_material(stage, folder: Path, path: str, material, index: int):
    """UsdPreviewSurface from a glTF PBR material: colour, alpha, roughness, metalness and normal map."""
    usd_material = UsdShade.Material.Define(stage, path)
    surface = UsdShade.Shader.Define(stage, f"{path}/Surface")
    surface.CreateIdAttr("UsdPreviewSurface")
    usd_material.CreateSurfaceOutput().ConnectToSource(surface.ConnectableAPI(), "surface")
    reader = UsdShade.Shader.Define(stage, f"{path}/UV")
    reader.CreateIdAttr("UsdPrimvarReader_float2")
    reader.CreateInput("varname", Sdf.ValueTypeNames.Token).Set("st")
    reader.CreateOutput("result", Sdf.ValueTypeNames.Float2)

    pbr = material if isinstance(material, trimesh.visual.material.PBRMaterial) else None
    if pbr is None and material is not None:
        pbr = material.to_pbr()
    factor = np.array(pbr.baseColorFactor if pbr is not None and pbr.baseColorFactor is not None else [255, 255, 255, 255], dtype=float)
    factor = factor / 255.0 if factor.max() > 1 else factor
    alpha_mode = getattr(pbr, "alphaMode", None) or "OPAQUE"
    double_sided = bool(getattr(pbr, "doubleSided", False)) or alpha_mode != "OPAQUE"

    base = getattr(pbr, "baseColorTexture", None)
    if base is not None:
        file = save_texture(base, folder, f"base_{index}", keep_alpha=alpha_mode != "OPAQUE")
        tex = texture_node(stage, path, "BaseColor", file, reader, "sRGB")
        tex.CreateInput("scale", Sdf.ValueTypeNames.Float4).Set(Gf.Vec4f(*factor[:3], 1.0))
        surface.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(tex.ConnectableAPI(), "rgb")
        if alpha_mode != "OPAQUE":
            surface.CreateInput("opacity", Sdf.ValueTypeNames.Float).ConnectToSource(tex.ConnectableAPI(), "a")
            if alpha_mode == "MASK":
                surface.CreateInput("opacityThreshold", Sdf.ValueTypeNames.Float).Set(float(getattr(pbr, "alphaCutoff", None) or 0.5))
    else:
        surface.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*factor[:3]))

    roughness = float(pbr.roughnessFactor) if pbr is not None and pbr.roughnessFactor is not None else 0.8
    metallic = float(pbr.metallicFactor) if pbr is not None and pbr.metallicFactor is not None else 0.0
    packed = getattr(pbr, "metallicRoughnessTexture", None)
    if packed is not None:
        file = save_texture(packed, folder, f"orm_{index}", keep_alpha=False)
        tex = texture_node(stage, path, "MetalRough", file, reader, "raw")
        tex.CreateInput("scale", Sdf.ValueTypeNames.Float4).Set(Gf.Vec4f(1.0, roughness, metallic, 1.0))
        surface.CreateInput("roughness", Sdf.ValueTypeNames.Float).ConnectToSource(tex.ConnectableAPI(), "g")
        surface.CreateInput("metallic", Sdf.ValueTypeNames.Float).ConnectToSource(tex.ConnectableAPI(), "b")
    else:
        surface.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(roughness)
        surface.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(metallic)

    normal = getattr(pbr, "normalTexture", None)
    if normal is not None:
        file = save_texture(normal, folder, f"normal_{index}", keep_alpha=False)
        tex = texture_node(stage, path, "Normal", file, reader, "raw")
        tex.CreateInput("scale", Sdf.ValueTypeNames.Float4).Set(Gf.Vec4f(2, 2, 2, 1))
        tex.CreateInput("bias", Sdf.ValueTypeNames.Float4).Set(Gf.Vec4f(-1, -1, -1, 0))
        surface.CreateInput("normal", Sdf.ValueTypeNames.Normal3f).ConnectToSource(tex.ConnectableAPI(), "rgb")
    return usd_material, double_sided


def placed_meshes(glb: Path, yaw_degrees: float) -> list[trimesh.Trimesh]:
    scene = trimesh.load(glb, force="scene", process=False)
    meshes = []
    for node in scene.graph.nodes_geometry:
        transform, name = scene.graph[node]
        mesh = scene.geometry[name]
        if not isinstance(mesh, trimesh.Trimesh) or len(mesh.faces) == 0:
            continue
        mesh = mesh.copy()
        mesh.apply_transform(transform)
        meshes.append(mesh)
    turn = trimesh.transformations.rotation_matrix(math.radians(yaw_degrees), [0, 1, 0])
    for mesh in meshes:
        mesh.apply_transform(turn)
    low = np.min([m.bounds[0] for m in meshes], axis=0)
    high = np.max([m.bounds[1] for m in meshes], axis=0)
    shift = [-(low[0] + high[0]) / 2, -low[1], -(low[2] + high[2]) / 2]
    for mesh in meshes:
        mesh.apply_translation(shift)
    return meshes


def build(item: dict) -> tuple[Path, list[float]]:
    meshes = placed_meshes(MODELS / f"{item['model']}.glb", item.get("yawOffset", 0))
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        layer = folder / "model.usdc"
        stage = Usd.Stage.CreateNew(str(layer))
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        root = UsdGeom.Xform.Define(stage, "/Root")
        stage.SetDefaultPrim(root.GetPrim())
        Usd.ModelAPI(root.GetPrim()).SetKind("component")
        stage.SetMetadata("customLayerData", {"source": f"Roomset catalog: {item['name']}"})

        for index, mesh in enumerate(meshes):
            usd_mesh = UsdGeom.Mesh.Define(stage, f"/Root/Mesh_{index}")
            usd_mesh.CreateSubdivisionSchemeAttr("none")
            usd_mesh.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(mesh.vertices.astype(np.float32)))
            usd_mesh.CreateFaceVertexCountsAttr(Vt.IntArray([3] * len(mesh.faces)))
            usd_mesh.CreateFaceVertexIndicesAttr(Vt.IntArray(mesh.faces.astype(np.int32).ravel().tolist()))
            usd_mesh.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(mesh.vertex_normals.astype(np.float32)))
            usd_mesh.SetNormalsInterpolation(UsdGeom.Tokens.vertex)
            usd_mesh.CreateExtentAttr(Vt.Vec3fArray.FromNumpy(mesh.bounds.astype(np.float32)))
            visual = mesh.visual
            uv = getattr(visual, "uv", None)
            if uv is not None and len(uv) == len(mesh.vertices):
                # trimesh keeps UVs with the origin at the bottom left, as USD does.
                st = UsdGeom.PrimvarsAPI(usd_mesh).CreatePrimvar("st", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex)
                st.Set(Vt.Vec2fArray.FromNumpy(np.asarray(uv, dtype=np.float32)))
            material, double_sided = define_material(stage, folder, f"/Root/Materials/M_{index}", getattr(visual, "material", None), index)
            usd_mesh.CreateDoubleSidedAttr(double_sided)
            UsdShade.MaterialBindingAPI.Apply(usd_mesh.GetPrim()).Bind(material)

        stage.GetRootLayer().Save()
        bounds = UsdGeom.BBoxCache(Usd.TimeCode.Default(), ["default"]).ComputeWorldBound(stage.GetPseudoRoot()).ComputeAlignedRange()
        size = bounds.GetSize()
        out = OUT / f"{item['model']}.usdz"
        if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(str(layer)), str(out)):
            raise RuntimeError(f"packaging failed for {item['id']}")
    # Catalog size is width (X), depth (Z), height (Y).
    return out, [round(size[0], 3), round(size[2], 3), round(size[1], 3)]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = [item for item in json.loads(CATALOG.read_text())["catalog"] if item.get("model")]
    failed = 0
    for item in catalog:
        out, size = build(item)
        drift = max(abs(a - b) / b for a, b in zip(size, item["size"]))
        ok = drift <= SIZE_TOLERANCE
        failed += not ok
        print(f"{'ok ' if ok else 'BAD'} {item['id']:<14} {size} vs catalog {item['size']}  {out.stat().st_size // 1024} KB")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
