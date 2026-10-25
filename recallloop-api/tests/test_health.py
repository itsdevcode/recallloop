import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.mark.parametrize(
    "database_url",
    [None, "postgresql+asyncpg://user:password@127.0.0.1:1/unavailable"],
)
def test_health_without_database(database_url: str | None) -> None:
    settings = Settings(_env_file=None, database_url=database_url)
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "recallloop-api"}


@pytest.mark.parametrize(
    "origin,allowed", [("https://web.example", True), ("https://other.example", False)]
)
def test_cors(origin: str, allowed: bool) -> None:
    settings = Settings(_env_file=None, cors_origins=["https://web.example"], database_url=None)
    with TestClient(create_app(settings)) as client:
        response = client.options(
            "/api/v1/health",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        )
    assert (response.headers.get("access-control-allow-origin") == origin) is allowed
    assert response.status_code == (200 if allowed else 400)
