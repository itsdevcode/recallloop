import asyncio
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.services import article_processing, extraction
from app.services.public_web import ExtractionError
from tests.conftest import migrate
from tests.test_auth import login, register

pytestmark = pytest.mark.asyncio
URL = "https://example.com/learning"


async def save(http, url=URL):
    return await http.post("/api/v1/articles", json={"url": url})


async def test_create_detail_list_and_delete(signed_in):
    http, app = signed_in
    response = await save(http)
    assert response.status_code == 202
    article = response.json()
    assert article["status"] == "PENDING"
    await run_processing(app, article["id"])
    article = (await http.get(f"/api/v1/articles/{article['id']}")).json()
    assert article["status"] == "READY"
    assert article["title"] == "Learning that lasts"
    assert "content" not in response.json() and "user_id" not in article
    assert response.headers["cache-control"] == "no-store"
    detail = await http.get(f"/api/v1/articles/{article['id']}")
    assert "Active recall" in detail.json()["content"]
    page = (await http.get("/api/v1/articles")).json()
    assert page["total"] == 1 and "content" not in page["items"][0]
    assert (await http.delete(f"/api/v1/articles/{article['id']}")).status_code == 204
    assert (await http.get(f"/api/v1/articles/{article['id']}")).status_code == 404
    assert (await http.delete(f"/api/v1/articles/{article['id']}")).status_code == 404


async def test_unauthenticated_requests(client):
    http, _ = client
    for method, path in [
        ("get", ""),
        ("post", ""),
        ("get", f"/{uuid4()}"),
        ("delete", f"/{uuid4()}"),
    ]:
        response = await http.request(method, "/api/v1/articles" + path, json={"url": URL})
        assert response.status_code == 401


@pytest.mark.parametrize(
    "url",
    [
        "not-a-url",
        "http://localhost",
        "http://10.0.0.1",
        "file:///etc/passwd",
        "https://user:password@example.com",
    ],
)
async def test_invalid_url_rejected(signed_in, url):
    http, _ = signed_in
    response = await save(http, url)
    assert response.status_code == 422
    assert "password@example" not in response.text
    assert (await http.get("/api/v1/articles")).json()["total"] == 0


async def test_duplicates_and_canonicalization(signed_in):
    http, _ = signed_in
    assert (await save(http, "https://EXAMPLE.com:443/learning#chapter")).status_code == 202
    assert (await save(http)).status_code == 409


async def test_concurrent_duplicate_registration(signed_in):
    http, _ = signed_in
    responses = await asyncio.gather(save(http), save(http))
    assert sorted(response.status_code for response in responses) == [202, 409]


async def test_ownership_and_same_url_for_other_user(signed_in):
    http, _ = signed_in
    first = (await save(http)).json()
    http.cookies.clear()
    await register(http, email="other@example.com")
    await login(http, email="other@example.com")
    assert (await http.get("/api/v1/articles")).json()["total"] == 0
    assert (await http.get(f"/api/v1/articles/{first['id']}")).status_code == 404
    assert (await http.delete(f"/api/v1/articles/{first['id']}")).status_code == 404
    assert (await save(http)).status_code == 202
    http.cookies.clear()
    await login(http)
    assert (await http.get(f"/api/v1/articles/{first['id']}")).status_code == 200


async def test_pagination_and_status_filter(signed_in):
    http, app = signed_in
    ids = []
    for i in range(3):
        ids.append((await save(http, URL + str(i))).json()["id"])
        await run_processing(app, ids[-1])
    page = (await http.get("/api/v1/articles?limit=2&offset=0&status=READY")).json()
    assert page["total"] == 3
    assert [article["id"] for article in page["items"]] == ids[::-1][:2]
    page = (await http.get("/api/v1/articles?limit=2&offset=2")).json()
    assert [article["id"] for article in page["items"]] == ids[:1]
    assert (await http.get("/api/v1/articles?status=FAILED")).json()["total"] == 0
    assert (await http.get("/api/v1/articles?limit=101")).status_code == 422


async def test_extraction_failure_is_safe_and_persisted(signed_in, monkeypatch):
    http, app = signed_in
    monkeypatch.setattr(
        extraction,
        "fetch_public_html",
        AsyncMock(side_effect=ExtractionError("The website could not be accessed.")),
    )
    response = await save(http)
    assert response.status_code == 202
    await run_processing(app, response.json()["id"])
    response = await http.get(f"/api/v1/articles/{response.json()['id']}")
    assert response.json()["status"] == "FAILED"
    assert response.json()["error_message"] == "The website could not be accessed."
    detail = (await http.get(f"/api/v1/articles/{response.json()['id']}")).json()
    assert detail["content"] is None


async def test_csrf_create_and_delete(signed_in):
    http, _ = signed_in
    article = (await save(http)).json()
    for headers in [
        {"Origin": "https://attacker.example", "X-CSRF-Protection": "1"},
        {"Origin": "http://localhost:3000", "X-CSRF-Protection": "invalid"},
    ]:
        assert (
            await http.post("/api/v1/articles", json={"url": URL + "2"}, headers=headers)
        ).status_code == 403
        assert (
            await http.delete(f"/api/v1/articles/{article['id']}", headers=headers)
        ).status_code == 403


async def test_article_migration_preserves_users(signed_in, database_url):
    http, app = signed_in
    await save(http)
    async with app.state.db_engine.connect() as connection:
        original_users = (
            await connection.execute(text("SELECT id, email FROM users ORDER BY id"))
        ).all()
    await asyncio.to_thread(migrate, database_url, "downgrade", "0001")
    async with app.state.db_engine.connect() as connection:
        assert await connection.scalar(text("SELECT to_regclass('articles')")) is None
        assert (
            await connection.execute(text("SELECT id, email FROM users ORDER BY id"))
        ).all() == original_users
    await asyncio.to_thread(migrate, database_url, "upgrade", "head")
    await asyncio.to_thread(migrate, database_url, "check")


async def run_processing(app, identifier):
    return await article_processing.process_article(
        UUID(identifier),
        async_sessionmaker(app.state.db_engine, expire_on_commit=False),
        app.state.settings,
    )
