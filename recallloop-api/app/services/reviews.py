from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.spaced_repetition import Rating, ScheduleState, schedule_review
from app.models import Article, Concept, RecallCard, User
from app.models.article import ArticleStatus
from app.models.review import ReviewLog
from app.schemas.review import (
    CardAnswer,
    DueCard,
    DuePage,
    HistoryEntry,
    HistoryPage,
    ReviewResult,
    ReviewSchedule,
    ReviewStats,
    ScheduleDay,
)


def cards_query(user_id: UUID, *columns):
    return (
        select(*columns)
        .select_from(RecallCard)
        .join(Concept)
        .join(Article)
        .where(
            Article.user_id == user_id,
            Article.status == ArticleStatus.READY,
        )
    )


def log_result(log: ReviewLog) -> ReviewResult:
    return ReviewResult(
        review_log_id=log.id,
        card_id=log.card_id,
        rating=log.rating,
        reviewed_at=log.reviewed_at,
        next_review_at=log.next_review_at,
        interval_days=log.new_interval_days,
        repetition_count=log.repetition_count,
        ease_factor=float(log.ease_factor),
        review_count=log.review_count,
    )


async def due_cards(session: AsyncSession, user_id: UUID, now: datetime, limit: int) -> DuePage:
    rows = (
        (
            await session.execute(
                cards_query(
                    user_id,
                    RecallCard.id.label("card_id"),
                    RecallCard.question,
                    Article.title.label("article_title"),
                    Concept.title.label("concept_title"),
                    RecallCard.next_review_at,
                    func.count().over().label("total_due"),
                )
                .where(RecallCard.next_review_at <= now)
                .order_by(
                    RecallCard.next_review_at,
                    RecallCard.id,
                )
                .limit(limit)
            )
        )
        .mappings()
        .all()
    )
    return DuePage(
        items=[
            DueCard(**{key: value for key, value in row.items() if key != "total_due"})
            for row in rows
        ],
        total_due=rows[0]["total_due"] if rows else 0,
        limit=limit,
        as_of=now,
    )


async def reveal_answer(session: AsyncSession, user_id: UUID, card_id: UUID) -> CardAnswer:
    row = (
        await session.execute(
            select(RecallCard.id, RecallCard.answer)
            .join(Concept)
            .join(Article)
            .where(
                RecallCard.id == card_id,
                Article.user_id == user_id,
            )
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return CardAnswer(card_id=row.id, answer=row.answer)


async def submit_review(
    session: AsyncSession,
    user_id: UUID,
    card_id: UUID,
    rating: Rating,
    key: UUID,
    now: datetime,
) -> ReviewResult:
    # Lock order: user -> article -> card. The user lock serializes idempotency keys
    # across different cards; the article lock also excludes worker replacement/deletion.
    await session.execute(select(User.id).where(User.id == user_id).with_for_update())
    article_id = await session.scalar(
        select(Article.id)
        .join(Concept)
        .join(RecallCard)
        .where(
            Article.user_id == user_id,
            RecallCard.id == card_id,
        )
    )
    if article_id is None:
        raise HTTPException(status_code=404, detail="Card not found")
    article = await session.scalar(
        select(Article)
        .where(
            Article.id == article_id,
            Article.user_id == user_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if article is None:
        raise HTTPException(status_code=404, detail="Card not found")
    previous = await session.scalar(
        select(ReviewLog).where(
            ReviewLog.user_id == user_id,
            ReviewLog.idempotency_key == key,
        )
    )
    if previous is not None:
        if previous.card_id != card_id or previous.rating != rating:
            raise HTTPException(
                status_code=409, detail="Idempotency key was used for another review"
            )
        return log_result(previous)
    card = await session.scalar(
        select(RecallCard)
        .join(Concept)
        .where(
            RecallCard.id == card_id,
            Concept.article_id == article_id,
        )
        .with_for_update(of=RecallCard)
        .execution_options(populate_existing=True)
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    if article.status != ArticleStatus.READY or card.next_review_at > now:
        raise HTTPException(
            status_code=409, detail="This card is not currently due. Reload the due queue."
        )
    scheduled = schedule_review(
        ScheduleState(
            card.interval_days,
            card.repetition_count,
            card.ease_factor,
            card.review_count,
        ),
        rating,
        now,
    )
    state = scheduled.state
    log = ReviewLog(
        card_id=card_id,
        user_id=user_id,
        idempotency_key=key,
        rating=rating,
        previous_interval_days=card.interval_days,
        new_interval_days=state.interval_days,
        reviewed_at=now,
        next_review_at=scheduled.next_review_at,
        repetition_count=state.repetition_count,
        ease_factor=state.ease_factor,
        review_count=state.review_count,
    )
    card.interval_days = state.interval_days
    card.repetition_count = state.repetition_count
    card.ease_factor = state.ease_factor
    card.review_count = state.review_count
    card.last_reviewed_at = now
    card.next_review_at = scheduled.next_review_at
    session.add(log)
    await session.flush()
    result = log_result(log)
    await session.commit()
    return result


def utc_window(now: datetime) -> tuple[datetime, datetime]:
    start = now.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=7)


async def review_schedule(session: AsyncSession, user_id: UUID, now: datetime) -> ReviewSchedule:
    start, _ = utc_window(now)
    dates = [start + timedelta(days=i) for i in range(7)]
    # One statement gives overdue/current/future buckets a consistent database snapshot.
    counts = [
        func.count().filter(RecallCard.next_review_at < start),
        func.count().filter(RecallCard.next_review_at >= start, RecallCard.next_review_at <= now),
        *[
            func.count().filter(
                RecallCard.next_review_at > now,
                RecallCard.next_review_at >= day,
                RecallCard.next_review_at < day + timedelta(days=1),
            )
            for day in dates
        ],
    ]
    values = (await session.execute(cards_query(user_id, *counts))).one()
    return ReviewSchedule(
        as_of=now,
        overdue=values[0],
        due_today=values[1],
        upcoming=[ScheduleDay(date=day.date(), count=values[i + 2]) for i, day in enumerate(dates)],
    )


async def review_stats(session: AsyncSession, user_id: UUID, now: datetime) -> ReviewStats:
    start, end = utc_window(now)
    total_reviews = (
        select(func.count())
        .select_from(ReviewLog)
        .where(
            ReviewLog.user_id == user_id,
        )
        .scalar_subquery()
    )
    today_reviews = (
        select(func.count())
        .select_from(ReviewLog)
        .where(
            ReviewLog.user_id == user_id,
            ReviewLog.reviewed_at >= start,
            ReviewLog.reviewed_at < start + timedelta(days=1),
        )
        .scalar_subquery()
    )
    totals = (
        await session.execute(
            cards_query(
                user_id,
                func.count(),
                func.count().filter(RecallCard.next_review_at <= now),
                func.count().filter(
                    RecallCard.next_review_at > now, RecallCard.next_review_at < end
                ),
                func.min(RecallCard.next_review_at).filter(RecallCard.next_review_at > now),
                total_reviews,
                today_reviews,
            )
        )
    ).one()
    return ReviewStats(
        as_of=now,
        total_cards=totals[0],
        due_now=totals[1],
        upcoming_next_7_days=totals[2],
        next_review_at=totals[3],
        total_completed_reviews=totals[4],
        reviewed_today=totals[5],
    )


async def review_history(
    session: AsyncSession, user_id: UUID, limit: int, offset: int
) -> HistoryPage:
    base = (
        select(ReviewLog)
        .join(RecallCard)
        .join(Concept)
        .join(Article)
        .where(
            ReviewLog.user_id == user_id,
            Article.user_id == user_id,
        )
    )
    total = await session.scalar(select(func.count()).select_from(base.subquery()))
    rows = (
        (
            await session.execute(
                base.with_only_columns(
                    ReviewLog.id,
                    ReviewLog.card_id,
                    RecallCard.question,
                    Article.title.label("article_title"),
                    ReviewLog.rating,
                    ReviewLog.reviewed_at,
                    ReviewLog.next_review_at,
                )
                .order_by(ReviewLog.reviewed_at.desc(), ReviewLog.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .mappings()
        .all()
    )
    return HistoryPage(
        items=[HistoryEntry(**row) for row in rows], total=total or 0, limit=limit, offset=offset
    )
