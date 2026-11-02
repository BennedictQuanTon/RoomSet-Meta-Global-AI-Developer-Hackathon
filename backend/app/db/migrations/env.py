"""Alembic reads the same DATABASE_URL as the app."""

from alembic import context

from app.db.engine import get_engine
from app.db.models import Base


def run() -> None:
    with get_engine().connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            render_as_batch=connection.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()


run()
