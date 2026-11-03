"""Private artifact storage. Keys look like `sessions/<id>/photos/<photo>.jpg`."""

from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings


class Storage(Protocol):
    def put(self, key: str, data: bytes, content_type: str) -> None: ...
    def get(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...
    def delete_prefix(self, prefix: str) -> None: ...
    def ping(self) -> None: ...


@lru_cache
def get_storage() -> Storage:
    settings = get_settings()
    if settings.storage_backend == "s3":
        from app.storage.s3 import S3Storage

        return S3Storage(settings)
    from app.storage.local import LocalStorage

    return LocalStorage(settings.local_storage_dir)
