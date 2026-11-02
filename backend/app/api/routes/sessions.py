"""Create, read and delete a session, plus the labelled sample."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import ensure_editable, owned_session
from app.api.presenters import session_view
from app.core.security import hash_token, new_token
from app.db.engine import get_db
from app.db.models import SessionRow
from app.domain.session import SessionCreated, SessionView
from app.services.pipeline import build_sample
from app.services.retention import delete_session_files

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _create(db: Session) -> tuple[SessionRow, str]:
    token = new_token()
    row = SessionRow(
        id=str(uuid.uuid4()), token_hash=hash_token(token), clarifications=[], renders=[]
    )
    db.add(row)
    db.commit()
    return row, token


@router.post("", status_code=201)
def create_session(db: Session = Depends(get_db)) -> SessionCreated:
    row, token = _create(db)
    return SessionCreated(session=session_view(row), token=token)


@router.post("/sample", status_code=201)
def create_sample(db: Session = Depends(get_db)) -> SessionCreated:
    row, token = _create(db)
    build_sample(row.id)
    db.refresh(row)
    return SessionCreated(session=session_view(row), token=token)


@router.get("/{session_id}")
def read_session(row: SessionRow = Depends(owned_session)) -> SessionView:
    return session_view(row)


@router.delete("/{session_id}", status_code=204)
def delete_session(row: SessionRow = Depends(owned_session), db: Session = Depends(get_db)) -> None:
    ensure_editable(row)
    delete_session_files(row.id)
    db.delete(row)
    db.commit()
