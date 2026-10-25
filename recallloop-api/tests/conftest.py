"""Integration tests use only an explicitly selected, local, disposable *_test database."""

import os
import subprocess
import sys
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import Settings
from app.main import create_app

API_ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "http://localhost:3000"
CSRF_HEADERS = {"Origin": ORIGIN, "X-CSRF-Protection": "1"}
TEST_SECRET = "a-test-only-signing-key-with-at-least-32-characters"


def validate_test_database(url: str, development_url: str | None) -> str:
    parsed = make_url(url)
    if (
        parsed.drivername != "postgresql+asyncpg"
        or parsed.host not in {"localhost", "127.0.0.1", "::1"}
        or not parsed.database
        or not parsed.database.endswith("_test")
    ):
        raise ValueError("Tests require a local postgresql+asyncpg database ending in _test")
    if development_url:
        dev = make_url(development_url)
        # Refuse the same database even if credentials or host aliases differ.
        if dev.database == parsed.database:
            raise ValueError("TEST_DATABASE_URL must differ from DATABASE_URL")
    return url


def migrate(url: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=API_ROOT,
        env={**os.environ, "DATABASE_URL": url, "APP_ENV": "development"},
        check=True,
        capture_output=True,
        text=True,
    )


@pytest.fixture(scope="session")
def database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("PostgreSQL integration tests require explicit TEST_DATABASE_URL")
    # Also compare the local .env database, not just the process environment.
    settings = Settings()
    validate_test_database(url, str(settings.database_url) if settings.database_url else None)
    migrate(url, "upgrade", "head")
    return url


@pytest_asyncio.fixture
async def client(database_url):
    settings = Settings(
        _env_file=None,
        database_url=database_url,
        jwt_secret_key=TEST_SECRET,
        frontend_origin=ORIGIN,
        auth_cookie_secure=False,
        app_env="development",
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with app.state.db_engine.begin() as connection:
            await connection.execute(
                text("TRUNCATE TABLE recall_cards, concepts, processing_budgets, articles, users")
            )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url=ORIGIN,
            headers=CSRF_HEADERS,
        ) as http_client:
            yield http_client, app
        async with app.state.db_engine.begin() as connection:
            await connection.execute(
                text("TRUNCATE TABLE recall_cards, concepts, processing_budgets, articles, users")
            )


@pytest_asyncio.fixture
async def signed_in(client, monkeypatch):
    from unittest.mock import AsyncMock

    from app.services import article_processing, extraction, queue
    from tests.learning_fixtures import learning_result
    from tests.test_auth import login, register
    from tests.test_public_web import HTML

    http, app = client
    await register(http)
    await login(http)
    monkeypatch.setattr(extraction, "fetch_public_html", AsyncMock(return_value=HTML))
    monkeypatch.setattr(queue, "enqueue_article", AsyncMock())
    monkeypatch.setattr(
        article_processing, "generate_learning", AsyncMock(return_value=learning_result())
    )
    return http, app
