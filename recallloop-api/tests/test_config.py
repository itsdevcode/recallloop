from pytest import MonkeyPatch

from app.core.config import Settings


def test_settings_read_database_and_comma_separated_origins(monkeypatch: MonkeyPatch) -> None:
    database_url = "postgresql+asyncpg://user:password@localhost:5432/recallloop"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("CORS_ORIGINS", " https://app.example.com, http://localhost:3000, ")
    settings = Settings(_env_file=None)
    assert settings.async_database_url == database_url
    assert settings.cors_origins == ["https://app.example.com", "http://localhost:3000"]


def test_test_database_safety_checks() -> None:
    import pytest

    from tests.conftest import validate_test_database

    for unsafe in [
        "postgresql+asyncpg://user@localhost/recallloop",
        "postgresql+asyncpg://user@remote.example/recallloop_test",
        "sqlite:///recallloop_test",
    ]:
        with pytest.raises(ValueError):
            validate_test_database(unsafe, None)
    with pytest.raises(ValueError):
        validate_test_database(
            "postgresql+asyncpg://user@127.0.0.1/recallloop_test",
            "postgresql+asyncpg://other@localhost/recallloop_test",
        )


def test_production_rejects_insecure_configuration() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_secret_key="too-short")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_algorithm="HS384")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins=["*"])
