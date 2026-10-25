import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.dependencies.reviews import review_time
from app.models import Article, Concept, RecallCard, ReviewLog
from app.models.article import ArticleStatus
from tests.conftest import migrate
from tests.test_articles import run_processing, save
from tests.test_auth import login, register

NOW = datetime(2030, 6, 10, 12, 0, 0, 123456, tzinfo=UTC)
pytestmark = pytest.mark.asyncio


def sessions(app):
    return async_sessionmaker(app.state.db_engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def learning(signed_in):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    assert (await run_processing(app, identifier)).state == "ready"
    app.dependency_overrides[review_time] = lambda: NOW
    async with sessions(app).begin() as session:
        cards = (
            await session.scalars(
                select(RecallCard)
                .join(Concept)
                .where(Concept.article_id == UUID(identifier))
                .order_by(Concept.position)
            )
        ).all()
        values = [(card.id, card.question, card.answer) for card in cards]
        for card in cards:
            card.next_review_at = NOW
    return http, app, identifier, values


async def rate(http, identifier, rating="EASY", key=None):
    return await http.post(
        f"/api/v1/reviews/cards/{identifier}",
        json={"rating": rating},
        headers={"Idempotency-Key": str(key or uuid4())},
    )


async def test_generated_cards_have_initial_schedule(signed_in):
    http, app = signed_in
    identifier = (await save(http)).json()["id"]
    await run_processing(app, identifier)
    async with sessions(app)() as session:
        cards = (await session.scalars(select(RecallCard))).all()
        assert len(cards) == 3
        for card in cards:
            assert card.next_review_at == card.created_at
            assert card.next_review_at.tzinfo is not None
            assert card.last_reviewed_at is None
            assert (card.interval_days, card.repetition_count, card.review_count) == (0, 0, 0)
            assert card.ease_factor == Decimal("2.50")


async def test_due_endpoint_hides_answers_and_orders_stably(learning):
    http, app, _, cards = learning
    async with sessions(app).begin() as session:
        card = await session.get(RecallCard, cards[2][0])
        card.next_review_at = NOW + timedelta(seconds=1)
    response = await http.get("/api/v1/reviews/due?limit=1")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["total_due"] == 2
    assert body["as_of"] == NOW.isoformat().replace("+00:00", "Z")
    assert body["items"][0]["card_id"] == str(min(cards[0][0], cards[1][0]))
    assert set(body["items"][0]) == {
        "card_id",
        "question",
        "article_title",
        "concept_title",
        "next_review_at",
    }
    assert "answer" not in response.text
    for _, _, answer in cards:
        assert answer not in response.text
    assert (await http.get("/api/v1/reviews/due?limit=51")).status_code == 422


async def test_reveal_is_read_only_and_private(learning):
    http, app, _, cards = learning
    response = await http.get(f"/api/v1/reviews/cards/{cards[0][0]}/answer")
    assert response.json() == {"card_id": str(cards[0][0]), "answer": cards[0][2]}
    assert response.headers["cache-control"] == "no-store"
    async with sessions(app)() as session:
        assert await session.scalar(select(func.count()).select_from(ReviewLog)) == 0
        assert (await session.get(RecallCard, cards[0][0])).review_count == 0


@pytest.mark.parametrize(
    "rating,interval,delay",
    [
        ("FORGOT", 0, timedelta(minutes=10)),
        ("HARD", 1, timedelta(days=1)),
        ("EASY", 3, timedelta(days=3)),
    ],
)
async def test_review_schedules_and_logs_atomically(learning, rating, interval, delay):
    http, app, _, cards = learning
    response = await rate(http, cards[0][0], rating)
    assert response.status_code == 200
    body = response.json()
    assert body["review_count"] == 1 and body["interval_days"] == interval
    assert datetime.fromisoformat(body["next_review_at"]) == NOW + delay
    async with sessions(app)() as session:
        card = await session.get(RecallCard, cards[0][0])
        log = await session.scalar(select(ReviewLog))
        assert card.next_review_at == log.next_review_at == NOW + delay
        assert card.last_reviewed_at == log.reviewed_at == NOW
        assert log.previous_interval_days == 0 and log.new_interval_days == interval
        assert card.review_count == log.review_count == 1
    assert (await http.get("/api/v1/reviews/due")).json()["total_due"] == 2
    assert (await rate(http, cards[0][0], rating)).status_code == 409


async def test_idempotent_replay_is_immutable_even_when_card_due_again(learning):
    http, app, _, cards = learning
    key = uuid4()
    first = await rate(http, cards[0][0], "FORGOT", key)
    later = NOW + timedelta(minutes=11)
    app.dependency_overrides[review_time] = lambda: later
    replay = await rate(http, cards[0][0], "FORGOT", key)
    assert replay.status_code == 200 and replay.json() == first.json()
    assert (await rate(http, cards[0][0], "HARD", key)).status_code == 409
    assert (await rate(http, cards[1][0], "FORGOT", key)).status_code == 409
    async with sessions(app)() as session:
        assert await session.scalar(select(func.count()).select_from(ReviewLog)) == 1
        assert (await session.get(RecallCard, cards[0][0])).review_count == 1
    assert (await rate(http, cards[0][0], "HARD")).json()["review_count"] == 2
    assert (await rate(http, cards[0][0], "FORGOT", key)).json() == first.json()


@pytest.mark.parametrize("same_key", [True, False])
async def test_concurrent_submissions_count_once(learning, same_key):
    http, app, _, cards = learning
    first, second = uuid4(), uuid4()
    results = await asyncio.gather(
        rate(http, cards[0][0], key=first),
        rate(http, cards[0][0], key=first if same_key else second),
    )
    assert sorted(r.status_code for r in results) == ([200, 200] if same_key else [200, 409])
    if same_key:
        assert results[0].json() == results[1].json()
    async with sessions(app)() as session:
        assert await session.scalar(select(func.count()).select_from(ReviewLog)) == 1
        assert (await session.get(RecallCard, cards[0][0])).review_count == 1


async def test_same_idempotency_key_for_different_cards_is_serialized(learning):
    http, app, _, cards = learning
    key = uuid4()
    results = await asyncio.gather(
        rate(http, cards[0][0], key=key), rate(http, cards[1][0], key=key)
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    async with sessions(app)() as session:
        assert await session.scalar(select(func.sum(RecallCard.review_count))) == 1
        assert await session.scalar(select(func.count()).select_from(ReviewLog)) == 1


async def test_failed_log_insert_rolls_back_schedule(learning):
    http, app, _, cards = learning
    async with app.state.db_engine.begin() as connection:
        await connection.execute(
            text("ALTER TABLE review_logs ADD CONSTRAINT test_reject_logs CHECK (false) NOT VALID")
        )
    try:
        with pytest.raises(IntegrityError):
            await rate(http, cards[0][0])
        async with sessions(app)() as session:
            card = await session.get(RecallCard, cards[0][0])
            assert card.review_count == 0 and card.next_review_at == NOW
            assert await session.scalar(select(func.count()).select_from(ReviewLog)) == 0
    finally:
        async with app.state.db_engine.begin() as connection:
            await connection.execute(
                text("ALTER TABLE review_logs DROP CONSTRAINT test_reject_logs")
            )


async def test_owner_boundaries_and_authentication(learning):
    http, _, _, cards = learning
    await rate(http, cards[0][0])
    http.cookies.clear()
    assert (await http.get("/api/v1/reviews/due")).status_code == 401
    await register(http, email="foreign@example.com")
    await login(http, email="foreign@example.com")
    assert (await http.get("/api/v1/reviews/due")).json()["total_due"] == 0
    assert (await http.get("/api/v1/reviews/history")).json()["total"] == 0
    assert (await http.get("/api/v1/reviews/stats")).json()["total_cards"] == 0
    assert (
        sum(d["count"] for d in (await http.get("/api/v1/reviews/schedule")).json()["upcoming"])
        == 0
    )
    for identifier in [cards[0][0], uuid4()]:
        assert (await http.get(f"/api/v1/reviews/cards/{identifier}/answer")).status_code == 404
        assert (await rate(http, identifier)).status_code == 404


async def test_csrf_invalid_ratings_and_idempotency_are_required(learning):
    http, _, _, cards = learning
    path = f"/api/v1/reviews/cards/{cards[0][0]}"
    assert (
        await http.post(
            path,
            json={"rating": "EASY"},
            headers={"Idempotency-Key": str(uuid4()), "X-CSRF-Protection": "wrong"},
        )
    ).status_code == 403
    assert (await http.post(path, json={"rating": "EASY"})).status_code == 422
    assert (await rate(http, cards[0][0], "INVALID")).status_code == 422
    assert (
        await http.post(
            path,
            json={"rating": "EASY", "user_id": str(uuid4())},
            headers={"Idempotency-Key": str(uuid4())},
        )
    ).status_code == 422
    assert (await http.get("/api/v1/reviews/history")).json()["total"] == 0


async def test_utc_schedule_stats_and_history(learning):
    http, app, _, cards = learning
    await rate(http, cards[0][0], "FORGOT")
    async with sessions(app).begin() as session:
        second = await session.get(RecallCard, cards[1][0])
        second.next_review_at = NOW - timedelta(days=1)
    stats = (await http.get("/api/v1/reviews/stats")).json()
    assert {
        key: stats[key]
        for key in [
            "total_cards",
            "due_now",
            "reviewed_today",
            "total_completed_reviews",
            "upcoming_next_7_days",
        ]
    } == {
        "total_cards": 3,
        "due_now": 2,
        "reviewed_today": 1,
        "total_completed_reviews": 1,
        "upcoming_next_7_days": 1,
    }
    schedule = (await http.get("/api/v1/reviews/schedule")).json()
    assert schedule["overdue"] == 1 and schedule["due_today"] == 1
    assert len(schedule["upcoming"]) == 7
    assert schedule["upcoming"][0] == {"date": "2030-06-10", "count": 1}
    assert sum(day["count"] for day in schedule["upcoming"]) == 1
    await rate(http, cards[1][0], "HARD")
    await rate(http, cards[2][0], "EASY")
    history = (await http.get("/api/v1/reviews/history?limit=2&offset=0")).json()
    assert history["total"] == 3 and len(history["items"]) == 2
    more = (await http.get("/api/v1/reviews/history?limit=2&offset=2")).json()
    ids = [row["id"] for row in history["items"] + more["items"]]
    assert len(set(ids)) == 3 and ids == sorted(ids, reverse=True)
    assert all("answer" not in row for row in history["items"])
    assert (await http.get("/api/v1/reviews/history?limit=101")).status_code == 422


async def test_utc_boundary_excludes_eighth_date_and_counts_review_events(learning):
    http, app, _, cards = learning
    start = NOW.replace(hour=0, minute=0, second=0, microsecond=0)
    async with sessions(app).begin() as session:
        for identifier, date in [
            (cards[0][0], start + timedelta(days=7) - timedelta(microseconds=1)),
            (cards[1][0], start + timedelta(days=7)),
            (cards[2][0], start),
        ]:
            (await session.get(RecallCard, identifier)).next_review_at = date
    schedule = (await http.get("/api/v1/reviews/schedule")).json()
    assert schedule["due_today"] == 1 and schedule["overdue"] == 0
    assert schedule["upcoming"][-1] == {"date": "2030-06-16", "count": 1}
    assert (await http.get("/api/v1/reviews/stats")).json()["upcoming_next_7_days"] == 1
    await rate(http, cards[2][0], "FORGOT")
    later = NOW + timedelta(minutes=10)
    app.dependency_overrides[review_time] = lambda: later
    await rate(http, cards[2][0], "FORGOT")
    assert (await http.get("/api/v1/reviews/stats")).json()["reviewed_today"] == 2


async def test_article_delete_cascades_review_logs(learning):
    http, app, article_id, cards = learning
    await rate(http, cards[0][0])
    assert (await http.delete(f"/api/v1/articles/{article_id}")).status_code == 204
    async with sessions(app)() as session:
        assert await session.scalar(select(func.count()).select_from(ReviewLog)) == 0
    assert (await http.get("/api/v1/reviews/stats")).json()["total_completed_reviews"] == 0


async def test_worker_never_replaces_reviewed_cards(learning):
    http, app, article_id, cards = learning
    await rate(http, cards[0][0])
    before = (await http.get(f"/api/v1/articles/{article_id}/concepts")).json()
    async with sessions(app).begin() as session:
        await session.execute(
            update(Article)
            .where(Article.id == UUID(article_id))
            .values(status=ArticleStatus.PENDING)
        )
    from app.services import article_processing

    article_processing.generate_learning.reset_mock()
    assert (await run_processing(app, article_id)).state == "ready"
    article_processing.generate_learning.assert_not_awaited()
    assert (await http.get(f"/api/v1/articles/{article_id}/concepts")).json() == before
    async with sessions(app)() as session:
        card = await session.get(RecallCard, cards[0][0])
        assert card.review_count == 1 and card.interval_days == 3
        assert await session.scalar(select(func.count()).select_from(ReviewLog)) == 1


async def test_0004_backfill_preserves_questions_answers_and_0003_data(learning, database_url):
    _, app, _, cards = learning
    async with app.state.db_engine.connect() as connection:
        original = (
            await connection.execute(
                text("SELECT id, question, answer, created_at FROM recall_cards ORDER BY id")
            )
        ).all()
    await asyncio.to_thread(migrate, database_url, "downgrade", "0003")
    async with app.state.db_engine.connect() as connection:
        assert (
            await connection.execute(
                text("SELECT id, question, answer, created_at FROM recall_cards ORDER BY id")
            )
        ).all() == original
        assert await connection.scalar(text("SELECT to_regclass('review_logs')")) is None
    await asyncio.to_thread(migrate, database_url, "upgrade", "head")
    async with sessions(app)() as session:
        for identifier, _, _ in cards:
            card = await session.get(RecallCard, identifier)
            assert card.next_review_at == card.created_at and card.review_count == 0
    await asyncio.to_thread(migrate, database_url, "check")
