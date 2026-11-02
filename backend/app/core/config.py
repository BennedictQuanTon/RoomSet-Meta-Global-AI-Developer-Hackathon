"""Runtime configuration. Every value comes from the environment or `.env`."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    roomset_env: Literal["dev", "test", "prod"] = "dev"
    frontend_dist: str = "../frontend/dist"

    database_url: str = "sqlite:///./data/roomset.db"

    storage_backend: Literal["local", "s3"] = "local"
    local_storage_dir: str = "./data/artifacts"
    s3_endpoint_url: str = ""
    s3_bucket: str = "roomset"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "auto"

    baseten_api: str = ""
    baseten_base_url: str = "https://inference.baseten.co/v1"
    baseten_model: str = "meta-models/muse-spark-open-1026"
    muse_api: str = ""
    meta_base_url: str = "https://api.meta.ai/v1"
    muse_image_model: str = "muse-image-1.0"

    scene_builder: Literal["local", "modal"] = "local"
    modal_app_name: str = "roomset-worker"

    max_concurrent_jobs: int = Field(default=2, ge=1, le=8)
    max_renders_per_session: int = Field(default=10, ge=0)
    max_sessions_per_minute: int = Field(default=10, ge=1)
    max_requests_per_minute: int = Field(default=240, ge=1)
    retention_days: int = Field(default=7, ge=1)

    max_upload_bytes: int = 10 * 1024 * 1024
    max_photos: int = 6
    min_photos: int = 3
    provider_timeout_s: float = 90.0

    @property
    def spark_enabled(self) -> bool:
        return bool(self.baseten_api)

    @property
    def image_enabled(self) -> bool:
        return bool(self.muse_api)


@lru_cache
def get_settings() -> Settings:
    return Settings()
