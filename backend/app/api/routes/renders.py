"""Style preview on request. Capped per session because each one costs money."""

import uuid

from fastapi import APIRouter, Depends, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import owned_session, read_upload
from app.core.config import get_settings
from app.core.errors import AppError, Conflict
from app.db.engine import get_db
from app.db.models import SessionRow
from app.domain.session import RenderView
from app.services.images import clean_image
from app.services.pipeline import asset_key
from app.services.renders import render_style
from app.storage.base import get_storage

router = APIRouter(prefix="/api/sessions/{session_id}/renders", tags=["renders"])


@router.post("", status_code=201)
async def create_render(
    snapshot: UploadFile,
    style_prompt: str = Form(min_length=2, max_length=300),
    row: SessionRow = Depends(owned_session),
    db: Session = Depends(get_db),
) -> RenderView:
    if row.status != "ready" or not row.scene:
        raise Conflict("scene_not_ready", "The scene isn't ready yet.")
    renders = row.renders or []
    if len(renders) >= get_settings().max_renders_per_session:
        raise AppError("render_limit", "This session has reached its style preview limit.", 429)

    clean = clean_image(await read_upload(snapshot), max_edge=1280)
    storage = get_storage()
    room_photo = storage.get(row.photos[0].storage_key) if row.photos else None
    sofa = (row.product or {}).get("appearance") or (row.product or {}).get("name") or "sofa"
    db.commit()  # Release the connection during the slow provider call.

    image = clean_image(render_style(clean.data, style_prompt, sofa, room_photo))
    render_id = str(uuid.uuid4())
    name = f"render-{render_id}.jpg"
    storage.put(asset_key(row.id, name), image.data, "image/jpeg")
    view = RenderView(id=render_id, asset=name, style_prompt=style_prompt)
    row.renders = [*renders, view.model_dump(mode="json")]
    db.commit()
    return view
