import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.gemma import AIError, TransientAIError
from app.models import Article, Concept, ProcessingBudget, RecallCard
from app.models.article import ArticleStatus
from app.services import article_processing, queue
from app.workers.reconcile import reconcile
from tests.test_articles import URL, run_processing, save

pytestmark = pytest.mark.asyncio


def sessions(app):
    return async_sessionmaker(app.state.db_engine, expire_on_commit=False)


async def test_commit_before_enqueue_and_no_in_request_inference(signed_in, monkeypatch):
    http, app = signed_in
    seen = []

    async def publish(identifier):
        assert app.state.db_engine.sync_engine.pool.checkedout() == 0
        async with sessions(app)() as session:
            stored = await session.get(Article, identifier)
            assert stored.status == ArticleStatus.PENDING and stored.content is None
            seen.append(identifier)

    monkeypatch.setattr(queue, "enqueue_article", publish)
    response = await save(http)
    assert response.status_code == 202 and response.json()["status"] == "PENDING"
    assert seen == [UUID(response.json()["id"])]
    article_processing.generate_learning.assert_not_awaited()


async def test_broker_failure_keeps_saved_retryable_state(signed_in, monkeypatch):
    http, app = signed_in
    monkeypatch.setattr(
        queue, "enqueue_article", AsyncMock(side_effect=OSError("SECRET_BROKER_URL"))
    )
    response = await save(http)
    assert response.status_code == 503 and "SECRET" not in response.text
    article = (await http.get("/api/v1/articles")).json()["items"][0]
    assert article["status"] == "FAILED"
    monkeypatch.setattr(queue, "enqueue_article", AsyncMock())
    response = await http.post(f"/api/v1/articles/{article['id']}/retry")
    assert response.status_code == 202
    assert response.json()["status"] == "PENDING"
    assert (await http.post(f"/api/v1/articles/{article['id']}/retry")).status_code == 409


async def test_worker_success_is_idempotent_and_cascades(signed_in):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    assert (await run_processing(app, identifier)).state == "ready"
    concepts = (await http.get(f"/api/v1/articles/{identifier}/concepts")).json()
    assert len(concepts) == 3 and all(len(c["cards"]) == 1 for c in concepts)
    assert (await run_processing(app, identifier)).state == "ignored"
    assert (await http.get(f"/api/v1/articles/{identifier}/concepts")).json() == concepts
    await http.delete(f"/api/v1/articles/{identifier}")
    async with sessions(app)() as session:
        assert await session.scalar(select(func.count()).select_from(Concept)) == 0
        assert await session.scalar(select(func.count()).select_from(RecallCard)) == 0


async def test_no_open_transaction_during_external_work(signed_in, monkeypatch):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    original_extract = article_processing.extract_article
    original_generate = article_processing.generate_learning

    async def extract(url):
        assert app.state.db_engine.sync_engine.pool.checkedout() == 0
        return await original_extract(url)

    async def generate(content, settings):
        assert app.state.db_engine.sync_engine.pool.checkedout() == 0
        return await original_generate(content, settings)

    monkeypatch.setattr(article_processing, "extract_article", extract)
    monkeypatch.setattr(article_processing, "generate_learning", generate)
    assert (await run_processing(app, identifier)).state == "ready"


async def test_duplicate_delivery_while_processing_is_ignored(signed_in, monkeypatch):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    started, release = asyncio.Event(), asyncio.Event()
    original = article_processing.generate_learning

    async def delayed(*args):
        started.set()
        await release.wait()
        return await original(*args)

    monkeypatch.setattr(article_processing, "generate_learning", delayed)
    task = asyncio.create_task(run_processing(app, identifier))
    await asyncio.wait_for(started.wait(), 5)
    try:
        assert (await run_processing(app, identifier)).state == "ignored"
    finally:
        release.set()
    assert (await task).state == "ready"
    original.assert_awaited_once()


async def test_provider_retries_are_bounded_and_preserve_text(signed_in, monkeypatch):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    monkeypatch.setattr(
        article_processing, "generate_learning", AsyncMock(side_effect=TransientAIError("busy"))
    )
    for attempt, expected in enumerate(["retry", "retry", "failed"], start=1):
        outcome = await run_processing(app, identifier)
        assert outcome.state == expected
        assert outcome.retry_delay == (5 * 2 ** (attempt - 1) if attempt < 3 else 0)
        async with sessions(app).begin() as session:
            article = await session.get(Article, UUID(identifier))
            assert article.content and article.processing_attempts == attempt
            article.available_at = datetime.now(UTC) - timedelta(seconds=1)
    assert (await http.post(f"/api/v1/articles/{identifier}/retry")).status_code == 409
    assert (await run_processing(app, identifier)).state == "ignored"


async def test_manual_retry_reuses_extracted_content(signed_in, monkeypatch):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    generate = article_processing.generate_learning
    monkeypatch.setattr(
        article_processing, "generate_learning", AsyncMock(side_effect=AIError("invalid AI output"))
    )
    assert (await run_processing(app, identifier)).state == "failed"
    async with sessions(app)() as session:
        assert (await session.get(Article, UUID(identifier))).content
    assert (await http.post(f"/api/v1/articles/{identifier}/retry")).status_code == 202
    monkeypatch.setattr(article_processing, "generate_learning", generate)
    extract = AsyncMock(side_effect=AssertionError("Must not re-extract cached text"))
    monkeypatch.setattr(article_processing, "extract_article", extract)
    assert (await run_processing(app, identifier)).state == "ready"
    extract.assert_not_awaited()


async def test_deleted_during_inference_is_not_recreated(signed_in, monkeypatch):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    generate = article_processing.generate_learning

    async def delete_then_generate(*args):
        assert (await http.delete(f"/api/v1/articles/{identifier}")).status_code == 204
        return await generate(*args)

    monkeypatch.setattr(article_processing, "generate_learning", delete_then_generate)
    assert (await run_processing(app, identifier)).state == "ignored"
    assert (await http.get(f"/api/v1/articles/{identifier}")).status_code == 404


async def test_stale_pending_and_expired_leases_recover(signed_in):
    http, app = signed_in
    identifiers = [(await save(http, URL + str(i))).json()["id"] for i in range(2)]
    old = datetime.now(UTC) - timedelta(minutes=5)
    async with sessions(app).begin() as session:
        for i, identifier in enumerate(identifiers):
            article = await session.get(Article, UUID(identifier))
            article.updated_at = old
            if i:
                article.status = ArticleStatus.PROCESSING
                article.lease_expires_at = old
                article.lease_token = uuid4()
    assert await reconcile(sessions(app)) == 2
    assert await reconcile(sessions(app)) == 0
    for identifier in identifiers:
        assert (await run_processing(app, identifier)).state == "ready"


async def test_lease_fencing_blocks_old_delivery(signed_in, monkeypatch):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    started, release = asyncio.Event(), asyncio.Event()
    original = article_processing.generate_learning
    calls = 0

    async def delayed(*args):
        nonlocal calls
        calls += 1
        if calls == 1:
            started.set()
            await release.wait()
        return await original(*args)

    monkeypatch.setattr(article_processing, "generate_learning", delayed)
    old_task = asyncio.create_task(run_processing(app, identifier))
    await asyncio.wait_for(started.wait(), 5)
    try:
        async with sessions(app).begin() as session:
            await session.execute(
                update(Article).values(lease_expires_at=datetime.now(UTC) - timedelta(seconds=1))
            )
        assert (await run_processing(app, identifier)).state == "ready"
    finally:
        release.set()
    assert (await old_task).state == "ignored"
    assert len((await http.get(f"/api/v1/articles/{identifier}/concepts")).json()) == 3


async def test_quota_survives_deletion_and_is_atomic(signed_in):
    http, app = signed_in
    app.state.settings.processing_requests_per_day = 1
    responses = await asyncio.gather(save(http, URL + "a"), save(http, URL + "b"))
    assert sorted(r.status_code for r in responses) == [202, 429]
    identifier = next(r.json()["id"] for r in responses if r.status_code == 202)
    await http.delete(f"/api/v1/articles/{identifier}")
    assert (await save(http, URL + "c")).status_code == 429
    async with sessions(app).begin() as session:
        budget = await session.scalar(select(ProcessingBudget))
        assert budget.requests == 1
        budget.window_start = datetime.now(UTC) - timedelta(days=2)
    assert (await save(http, URL + "c")).status_code == 202


async def test_concepts_and_retry_ownership_csrf_and_pending(signed_in):
    from tests.test_auth import login, register

    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    assert (await http.get(f"/api/v1/articles/{identifier}/concepts")).json() == []
    assert (
        await http.post(
            f"/api/v1/articles/{identifier}/retry", headers={"X-CSRF-Protection": "wrong"}
        )
    ).status_code == 403
    http.cookies.clear()
    await register(http, email="other@example.com")
    await login(http, email="other@example.com")
    assert (await http.get(f"/api/v1/articles/{identifier}/concepts")).status_code == 404
    assert (await http.post(f"/api/v1/articles/{identifier}/retry")).status_code == 404


async def test_ai_migration_round_trip_preserves_extracted_articles(signed_in, database_url):
    from sqlalchemy import text

    from tests.conftest import migrate

    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    assert (await run_processing(app, identifier)).state == "ready"
    async with sessions(app)() as session:
        content = (await session.get(Article, UUID(identifier))).content
    await asyncio.to_thread(migrate, database_url, "downgrade", "0002")
    async with app.state.db_engine.connect() as connection:
        assert await connection.scalar(text("SELECT to_regclass('concepts')")) is None
        assert await connection.scalar(text("SELECT content FROM articles")) == content
        assert await connection.scalar(text("SELECT status FROM articles")) == "READY"
        assert await connection.scalar(text("SELECT count(*) FROM users")) == 1
    await asyncio.to_thread(migrate, database_url, "upgrade", "head")
    async with app.state.db_engine.connect() as connection:
        assert await connection.scalar(text("SELECT content FROM articles")) == content
        assert await connection.scalar(text("SELECT status FROM articles")) == "PENDING"
    await asyncio.to_thread(migrate, database_url, "check")


async def test_exhausted_interrupted_job_becomes_failed(signed_in):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    async with sessions(app).begin() as session:
        article = await session.get(Article, UUID(identifier))
        article.status = ArticleStatus.PROCESSING
        article.processing_attempts = 3
        article.lease_expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert await reconcile(sessions(app)) == 0
    assert (await http.get(f"/api/v1/articles/{identifier}")).json()["status"] == "FAILED"
