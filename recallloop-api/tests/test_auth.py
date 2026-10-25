import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import jwt
import pytest
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.security import password_hasher
from app.models import User
from tests.conftest import CSRF_HEADERS, ORIGIN, TEST_SECRET, migrate

pytestmark = pytest.mark.asyncio
ACCOUNT = {"name": "Example User", "email": "user@example.com", "password": "StrongPassword123!"}


async def register(client, **changes):
    return await client.post("/api/v1/auth/register", json={**ACCOUNT, **changes})


async def login(client, **changes):
    return await client.post("/api/v1/auth/login", json={**ACCOUNT, **changes})


async def test_registration_profile_hash_and_normalization(client):
    http, app = client
    response = await register(http, email=" USER@Example.COM ", name=" Example User ")
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "name", "email", "is_active", "created_at", "updated_at"}
    assert body["email"] == "user@example.com"
    assert body["name"] == "Example User"
    assert body["is_active"] is True
    assert datetime.fromisoformat(body["created_at"]).utcoffset() == timedelta(0)
    async with async_sessionmaker(app.state.db_engine)() as session:
        user = await session.scalar(select(User))
        assert user.password_hash.startswith("$argon2id$")
        assert password_hasher.verify(ACCOUNT["password"], user.password_hash)
    assert (await register(http)).status_code == 409
    assert (await register(http, email="USER@example.com")).status_code == 409


async def test_login_me_and_logout(client):
    http, app = client
    registered = (await register(http)).json()
    response = await login(http, email=" USER@EXAMPLE.COM ")
    assert response.status_code == 200
    assert "password_hash" not in response.text and "token" not in response.json()
    cookie_header = response.headers["set-cookie"]
    assert "HttpOnly" in cookie_header and "SameSite=lax" in cookie_header
    assert "Max-Age=900" in cookie_header and "Path=/" in cookie_header
    token = http.cookies.get("recallloop_session")
    claims = jwt.decode(token, TEST_SECRET, algorithms=["HS256"])
    assert claims["sub"] == registered["id"]
    assert claims["exp"] - claims["iat"] == 900
    me = await http.get("/api/v1/auth/me")
    assert me.json() == registered
    assert me.headers["cache-control"] == "no-store"
    response = await http.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "Path=/" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    assert (await http.get("/api/v1/auth/me")).status_code == 401
    # Stateless logout deliberately does not revoke the copied JWT.
    http.cookies.set("recallloop_session", token)
    assert (await http.get("/api/v1/auth/me")).status_code == 200


async def test_wrong_unknown_and_inactive_credentials(client):
    http, app = client
    await register(http)
    wrong = await login(http, password="incorrect-password")
    unknown = await login(http, email="unknown@example.com")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert "set-cookie" not in wrong.headers
    await login(http)
    async with app.state.db_engine.begin() as connection:
        await connection.execute(update(User).values(is_active=False))
    inactive = await login(http)
    assert inactive.status_code == 401 and inactive.json() == wrong.json()
    assert (await http.get("/api/v1/auth/me")).status_code == 401


async def test_missing_credentials_and_bearer_not_accepted(client):
    http, _ = client
    assert (await http.get("/api/v1/auth/me")).status_code == 401
    await register(http)
    await login(http)
    token = http.cookies.get("recallloop_session")
    http.cookies.clear()
    assert (
        await http.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    ).status_code == 401


@pytest.mark.parametrize(
    "kind", ["invalid", "expired", "forged", "wrong_algorithm", "missing_exp", "bad_sub", "deleted"]
)
async def test_invalid_tokens(client, kind):
    http, _ = client
    user = (await register(http)).json()
    now = datetime.now(UTC)
    claims = {"sub": user["id"], "iat": now, "exp": now + timedelta(minutes=15)}
    key, algorithm = TEST_SECRET, "HS256"
    if kind == "expired":
        claims["exp"] = now - timedelta(seconds=1)
    elif kind == "forged":
        key = "different-secret-that-is-at-least-32-characters"
    elif kind == "wrong_algorithm":
        algorithm = "HS384"
    elif kind == "missing_exp":
        del claims["exp"]
    elif kind == "bad_sub":
        claims["sub"] = "invalid-uuid"
    elif kind == "deleted":
        claims["sub"] = str(uuid4())
    token = "invalid" if kind == "invalid" else jwt.encode(claims, key, algorithm=algorithm)
    http.cookies.set("recallloop_session", token)
    assert (await http.get("/api/v1/auth/me")).status_code == 401


async def test_altering_subject_cannot_impersonate_another_user(client):
    http, _ = client
    first = (await register(http)).json()
    second = (await register(http, email="second@example.com")).json()
    await login(http)
    token = http.cookies.get("recallloop_session")
    claims = jwt.decode(token, options={"verify_signature": False})
    assert claims["sub"] == first["id"]
    claims["sub"] = second["id"]
    forged = jwt.encode(claims, "attacker-secret-at-least-32-characters", algorithm="HS256")
    http.cookies.clear()
    http.cookies.set("recallloop_session", forged)
    assert (await http.get("/api/v1/auth/me")).status_code == 401


async def test_concurrent_duplicate_registration(client):
    http, app = client
    # Distinct requests and independent sessions race on the real unique constraint.
    responses = await asyncio.gather(register(http), register(http))
    assert sorted(response.status_code for response in responses) == [201, 409]
    async with app.state.db_engine.connect() as connection:
        assert await connection.scalar(text("SELECT count(*) FROM users")) == 1


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": ORIGIN},
        {"X-CSRF-Protection": "1"},
        {"Origin": "https://attacker.example", "X-CSRF-Protection": "1"},
        {"Origin": ORIGIN, "X-CSRF-Protection": "wrong"},
        {**CSRF_HEADERS, "Sec-Fetch-Site": "cross-site"},
        {"Origin": "null", "X-CSRF-Protection": "1"},
    ],
)
async def test_csrf_protects_all_mutations(client, headers):
    http, app = client
    await register(http)
    await login(http)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=ORIGIN,
        cookies=http.cookies,
    ) as attacker:
        for action in ["register", "login", "logout"]:
            response = await attacker.post(f"/api/v1/auth/{action}", json=ACCOUNT, headers=headers)
            assert response.status_code == 403
            assert "set-cookie" not in response.headers


@pytest.mark.parametrize(
    "changes",
    [
        {"name": " "},
        {"name": "x" * 121},
        {"email": "not-an-email"},
        {"password": "short"},
        {"password": "x" * 129},
    ],
)
async def test_validation_does_not_echo_passwords(client, changes):
    http, _ = client
    response = await register(http, **changes)
    assert response.status_code == 422
    assert ACCOUNT["password"] not in response.text
    assert "input" not in response.text


async def test_production_cookie_attributes_match_on_logout(client):
    http, app = client
    app.state.settings.auth_cookie_secure = True
    # HTTPS test client is needed to send a Secure cookie back.
    http.base_url = "https://localhost:3000"
    await register(http)
    response = await login(http)
    assert "Secure" in response.headers["set-cookie"]
    response = await http.post("/api/v1/auth/logout")
    assert "Secure" in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]


async def test_migration_round_trip(database_url):
    # All destructive operations are gated by the session fixture's URL safety checks.
    await asyncio.to_thread(migrate, database_url, "downgrade", "base")
    await asyncio.to_thread(migrate, database_url, "upgrade", "head")
    result = await asyncio.to_thread(migrate, database_url, "check")
    assert "No new upgrade operations detected" in result.stdout
