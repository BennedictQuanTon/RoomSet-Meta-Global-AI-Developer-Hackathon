"""Modal functions for jobs too heavy for the web host.

Deploy: `modal deploy worker/modal_app.py`, then set SCENE_BUILDER=modal on the backend.
Not yet run on Modal; record the first real job in docs/STATUS.md before claiming it.
"""

from pathlib import Path

import modal

app = modal.App("roomset-worker")

blender_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libxi6", "libxrender1", "libxkbcommon0", "libgl1", "libsm6", "libxfixes3")
    .pip_install("bpy==4.2.0")
    .add_local_file(Path(__file__).parent / "blender_build.py", "/root/blender_build.py")
)


@app.function(image=blender_image, cpu=2.0, memory=4096, timeout=300, max_containers=2)
def build_scene(spec: dict) -> dict:
    """Same inputs and outputs as LocalBuilder in backend/app/services/scene_builders.py."""
    import sys

    sys.path.insert(0, "/root")
    import blender_build

    width, height, depth = spec["sofa_size"]
    return {
        "room_glb": blender_build.build_room(spec["floor"], spec["walls"], spec["obstacles"]),
        "furniture_glb": blender_build.build_sofa(width, height, depth),
    }


@app.function(timeout=900, max_containers=1)
def reconstruct_corner(_photos: list[bytes]) -> dict:
    """Issue #4's VGGT spike goes here: GPU image, cached weights, then fit floor and walls.

    Cap the experiment at about four focused hours. If it fails, the assisted path stays.
    """
    raise NotImplementedError("VGGT reconstruction is not implemented yet.")
