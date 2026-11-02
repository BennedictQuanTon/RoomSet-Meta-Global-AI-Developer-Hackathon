"""Renders a furnished room from apartment.data.json into its real 360° photo with Blender Cycles.
Usage: render_room.py data.json models_dir hdri out.png room lookx lookz looky focal W H spp [layer]
World mapping: three (x, y, z) -> Blender (x, -z, y), matching the browser studio.
"""
import json
import math
import os
import sys
import bpy
from mathutils import Vector

data_path, models, hdri, out, room_id = sys.argv[1:6]
look_x, look_z, look_y, focal = map(float, sys.argv[6:10])
W, H, spp = map(int, sys.argv[10:13])
layer = sys.argv[13] if len(sys.argv) > 13 else "object"
data = json.load(open(data_path))
room = next(r for r in data["rooms"] if r["id"] == room_id)
catalog = {c["id"]: c for c in data["catalog"]}

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = True
    sc.cycles.device = "GPU"
except Exception:
    pass
sc.cycles.samples = spp
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.filepath = out
sc.view_settings.view_transform = "Standard"

world = bpy.data.worlds.new("w")
sc.world = world
world.use_nodes = True
env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(hdri)
world.node_tree.links.new(env.outputs[0], world.node_tree.nodes["Background"].inputs[0])

if layer == "object":
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = "RGBA"
    for entry in data["start"]:
        if entry["room"] != room_id:
            continue
        item = catalog[entry["id"]]
        lift = item.get("lift", 0)
        root = bpy.data.objects.new(entry["id"], None)
        sc.collection.objects.link(root)
        if "model" in item:
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.join(models, item["model"] + ".glb"))
            new = [o for o in bpy.data.objects if o not in before]
            bpy.context.view_layer.update()
            points = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
            low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
            high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
            shift = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
            for o in new:
                if o.parent is None:
                    o.location -= shift
                    o.parent = root
        else:
            w, d, h = item["size"]
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, h / 2))
            rug = bpy.context.object
            rug.scale = (w, d, h)
            mat = bpy.data.materials.new("rug")
            mat.use_nodes = True
            mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.26, 0.23, 0.19, 1)
            mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1
            rug.data.materials.append(mat)
            rug.parent = root
        root.location = (entry["x"], -entry["z"], lift)
        root.rotation_euler = (0, 0, math.radians(entry["yaw"] + item.get("yawOffset", 0)))
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 1.5
    sun.angle = math.radians(20)
    sun_object = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(sun_object)
    sun_object.rotation_euler = (math.radians(50), 0, math.radians(90))
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    bpy.context.object.is_shadow_catcher = True

camera = bpy.data.cameras.new("c")
camera.lens = focal
camera.sensor_width = 36
camera_object = bpy.data.objects.new("c", camera)
sc.collection.objects.link(camera_object)
sc.camera = camera_object
camera_object.location = (0, 0, room["captureHeight"])
direction = Vector((look_x, -look_z, look_y)) - camera_object.location
camera_object.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.ops.render.render(write_still=True)
