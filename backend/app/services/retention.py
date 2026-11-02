"""Deletes sessions and their files. Home photos are kept only for the stated retention period."""

import logging
import threading
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.db.engine import session_scope
from app.db.models import SessionRow
from app.storage.base import get_storage

log = logging.getLogger(__name__)
SWEEP_INTERVAL_S = 3600


def delete_session_files(session_id: str) -> None:
    get_storage().delete_prefix(f"sessions/{session_id}")


def purge_expired() -> int:
    cutoff = datetime.now(UTC) - timedelta(days=get_settings().retention_days)
    with session_scope() as db:
        rows = db.scalars(
            select(SessionRow)
            .where(SessionRow.created_at < cutoff)
            .where(SessionRow.status.not_in(("reconstructing", "building")))
            .limit(200)
        ).all()
        for row in rows:
            delete_session_files(row.id)
            db.delete(row)
        return len(rows)


def start_sweeper(stop: threading.Event) -> threading.Thread:
    def loop() -> None:
        while not stop.wait(SWEEP_INTERVAL_S):
            try:
                count = purge_expired()
                if count:
                    log.info("purged sessions", extra={"fields": {"count": count}})
            except Exception:
                log.exception("retention sweep failed")

    thread = threading.Thread(target=loop, name="retention", daemon=True)
    thread.start()
    return thread
