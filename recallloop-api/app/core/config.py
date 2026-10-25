"""Environment-based application configuration."""

from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator, PostgresDsn
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def parse_origins(value: object) -> object:
    if isinstance(value, str):
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "RecallLoop API"
    app_env: str = "development"
    # Optional for liveness checks; required when using sessions or migrations.
    database_url: PostgresDsn | None = None
    cors_origins: Annotated[list[str], NoDecode, BeforeValidator(parse_origins)] = [
        "http://localhost:3000"
    ]

    @property
    def async_database_url(self) -> str:
        if self.database_url is None:
            raise ValueError("DATABASE_URL is required for database operations")
        url = str(self.database_url)
        if not url.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use the postgresql+asyncpg:// driver")
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
