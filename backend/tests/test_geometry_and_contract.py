"""GLB output must hold the exact confirmed size, and the shared fixture must stay valid."""

import io
import json
from pathlib import Path

import numpy as np
import pytest
import trimesh

from app.domain.clarification import RoomAnswers
from app.domain.scene import SceneV1
from app.geometry.room import assisted_layout, build_room_glb
from app.geometry.sofa import build_sofa_glb

FIXTURE = Path(__file__).parents[2] / "contracts" / "fixtures" / "scene.fixture.json"


def _load(glb: bytes) -> trimesh.Scene:
    return trimesh.load(io.BytesIO(glb), file_type="glb", force="scene")


@pytest.mark.parametrize(
    "size", [(2.1, 0.84, 0.92), (1.4, 0.7, 0.75), (3.2, 1.05, 1.1), (0.9, 0.4, 0.5)]
)
def test_sofa_outer_box_matches_confirmed_dimensions(size):
    width, height, depth = size
    bounds = _load(build_sofa_glb(width, height, depth)).bounds
    np.testing.assert_allclose(bounds[1] - bounds[0], (width, height, depth), atol=1e-4)
    assert bounds[0][1] == pytest.approx(0, abs=1e-4), "pivot sits on the floor"
    np.testing.assert_allclose(
        [bounds[0][0] + bounds[1][0], bounds[0][2] + bounds[1][2]], [0, 0], atol=1e-4
    )


def test_sofa_nodes_are_not_scaled():
    scene = _load(build_sofa_glb(2.0, 0.8, 0.9))
    for node in scene.graph.nodes_geometry:
        matrix, _ = scene.graph[node]
        np.testing.assert_allclose(np.linalg.norm(matrix[:3, :3], axis=0), 1.0, atol=1e-6)


def test_sofa_back_faces_negative_z():
    scene = _load(build_sofa_glb(2.0, 0.8, 0.9))
    back = scene.geometry["back"].bounds
    assert back[0][2] == pytest.approx(-0.45, abs=1e-4)
    assert back[1][1] == pytest.approx(0.8, abs=1e-4)


def test_room_walls_have_their_inner_faces_on_the_floor_edges():
    answers = RoomAnswers(room_width_m=4, room_depth_m=3, dimensions_measured=True)
    floor, walls, obstacles = assisted_layout(answers)
    scene = _load(build_room_glb(floor, walls, obstacles))
    a = scene.geometry["wall_a"].bounds
    b = scene.geometry["wall_b"].bounds
    assert a[1][2] == pytest.approx(0, abs=1e-4)
    assert a[0][2] == pytest.approx(-0.1, abs=1e-4)
    assert (a[0][0], a[1][0]) == (pytest.approx(0, abs=1e-4), pytest.approx(4, abs=1e-4))
    assert b[1][0] == pytest.approx(0, abs=1e-4)
    assert b[0][0] == pytest.approx(-0.1, abs=1e-4)
    assert (b[0][2], b[1][2]) == (pytest.approx(0, abs=1e-4), pytest.approx(3, abs=1e-4))


def test_shared_fixture_matches_scene_v1():
    scene = SceneV1.model_validate(json.loads(FIXTURE.read_text()))
    assert scene.provenance.method == "sample"


def test_migrations_match_models(tmp_path, monkeypatch):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, inspect

    from app.db import engine as engine_module

    url = f"sqlite:///{tmp_path}/migrated.db"
    test_engine = create_engine(url)
    monkeypatch.setattr(engine_module, "get_engine", lambda: test_engine)
    import app.db.migrations  # noqa: F401 - package marker is optional

    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option(
        "script_location", str(Path(__file__).parents[1] / "app" / "db" / "migrations")
    )
    command.upgrade(config, "head")
    command.check(config)
    assert {"sessions", "photos"} <= set(inspect(test_engine).get_table_names())
