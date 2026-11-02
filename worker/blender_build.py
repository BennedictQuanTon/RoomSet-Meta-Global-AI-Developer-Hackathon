"""Trusted Blender builder. Takes structured numbers only; it never runs model-written code.

Input uses the Scene v1 frame (Y-up, floor XZ). Blender is Z-up, so points convert as
scene (x, y, z) -> Blender (x, -z, y), and the glTF exporter's Y-up option converts them back.
"""

import math
import os
import tempfile

import bpy

BODY = "#C66B48"
CUSHION = "#D27F5E"
FLOOR = "#D8D3C7"
WALL = "#F7F4ED"
OBSTACLE = "#929B80"


def _reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _material(hex_color: str):
    material = bpy.data.materials.new(hex_color)
    material.use_nodes = True
    srgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    principled = material.node_tree.nodes["Principled BSDF"]
    principled.inputs["Base Color"].default_value = (*linear, 1.0)
    principled.inputs["Roughness"].default_value = 0.85
    return material


def _box(name: str, size: tuple, center: tuple, color: str, yaw: float = 0.0) -> None:
    """Size and center are in the scene frame. Vertices carry the size, so object scale stays 1."""
    width, height, depth = size
    x, y, z = center
    half = (width / 2, depth / 2, height / 2)
    corners = [
        (sx * half[0], sy * half[1], sz * half[2])
        for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)
    ]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(corners, [], faces)
    mesh.update()
    mesh.materials.append(_material(color))
    item = bpy.data.objects.new(name, mesh)
    item.location = (x, -z, y)
    item.rotation_euler = (0.0, 0.0, yaw)
    bpy.context.scene.collection.objects.link(item)


def _export() -> bytes:
    with tempfile.TemporaryDirectory() as folder:
        path = os.path.join(folder, "out.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True)
        with open(path, "rb") as file:
            return file.read()


def build_sofa(width: float, height: float, depth: float) -> bytes:
    _reset()
    arm = min(0.14 * width, 0.2)
    back = min(0.24 * depth, 0.24)
    seat_top = min(0.45, 0.58 * height)
    base_top = seat_top * 0.55
    arm_top = min(height, seat_top + 0.2)
    inner = width - 2 * arm
    seat_depth = depth - back

    _box("base", (width, base_top, depth), (0, base_top / 2, 0), BODY)
    _box("back", (width, height, back), (0, height / 2, -depth / 2 + back / 2), BODY)
    _box("arm_left", (arm, arm_top, depth), (-width / 2 + arm / 2, arm_top / 2, 0), BODY)
    _box("arm_right", (arm, arm_top, depth), (width / 2 - arm / 2, arm_top / 2, 0), BODY)
    _box(
        "seat",
        (inner, seat_top - base_top, seat_depth),
        (0, (seat_top + base_top) / 2, -depth / 2 + back + seat_depth / 2),
        CUSHION,
    )
    return _export()


def build_room(floor: list, walls: list[dict], obstacles: list[dict]) -> bytes:
    _reset()
    xs, zs = [p[0] for p in floor], [p[1] for p in floor]
    _box(
        "floor",
        (max(xs) - min(xs), 0.02, max(zs) - min(zs)),
        ((max(xs) + min(xs)) / 2, -0.01, (max(zs) + min(zs)) / 2),
        FLOOR,
    )
    for wall in walls:
        (x1, z1), (x2, z2) = wall["start"], wall["end"]
        length = math.hypot(x2 - x1, z2 - z1)
        ux, uz = (x2 - x1) / length, (z2 - z1) / length
        thickness, height = wall["thickness"], wall["height"]
        center = ((x1 + x2) / 2 + uz * thickness / 2, height / 2, (z1 + z2) / 2 - ux * thickness / 2)
        _box(wall["id"], (length, height, thickness), center, WALL, yaw=math.atan2(-uz, ux))
    for item in obstacles:
        width, height, depth = item["size"]
        center = (item["center"][0], height / 2, item["center"][1])
        _box(item["id"], (width, height, depth), center, OBSTACLE, yaw=item.get("yaw", 0.0))
    return _export()
