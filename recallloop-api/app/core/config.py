"""Environment-based application configuration."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import BeforeValidator, Field, PostgresDsn, SecretStr, model_validator
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

    jwt_secret_key: SecretStr | None = Field(default=None, min_length=32)
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = Field(default=15, ge=1, le=15)
    frontend_origin: str = "http://localhost:3000"
    auth_cookie_name: str = "recallloop_session"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "strict"] = "lax"
    auth_cookie_path: str = "/"

    @model_validator(mode="after")
    def validate_auth_configuration(self) -> "Settings":
        from urllib.parse import urlsplit

        origin = urlsplit(self.frontend_origin)
        if (
            origin.scheme not in {"http", "https"}
            or not origin.netloc
            or origin.path
            or origin.query
            or origin.fragment
            or origin.username
        ):
            raise ValueError("FRONTEND_ORIGIN must be an explicit HTTP(S) origin without a path")
        if "*" in self.cors_origins:
            raise ValueError("CORS_ORIGINS must contain explicit origins")
        if self.auth_cookie_path != "/":
            raise ValueError("AUTH_COOKIE_PATH must be / for the same-origin proxy")
        if self.app_env == "production":
            if not self.auth_cookie_secure or origin.scheme != "https":
                raise ValueError("Production requires secure cookies and an HTTPS frontend origin")
            if self.jwt_secret_key is None:
                raise ValueError("Production requires JWT_SECRET_KEY")
        return self

    @property
    def signing_key(self) -> str:
        if self.jwt_secret_key is None:
            raise RuntimeError("JWT_SECRET_KEY is required for authentication")
        return self.jwt_secret_key.get_secret_value()

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
