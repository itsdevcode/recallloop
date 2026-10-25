from pytest import MonkeyPatch

from app.core.config import Settings


def test_settings_read_database_and_comma_separated_origins(monkeypatch: MonkeyPatch) -> None:
    database_url = "postgresql+asyncpg://user:password@localhost:5432/recallloop"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("CORS_ORIGINS", " https://app.example.com, http://localhost:3000, ")
    settings = Settings(_env_file=None)
    assert settings.async_database_url == database_url
    assert settings.cors_origins == ["https://app.example.com", "http://localhost:3000"]
