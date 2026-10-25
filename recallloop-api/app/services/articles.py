from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import MAX_ATTEMPTS, Settings
from app.models import ProcessingBudget
from app.models.article import Article, ArticleStatus
from app.services import queue


async def owned_article(session: AsyncSession, user_id: UUID, article_id: UUID) -> Article:
    article = await session.scalar(
        select(Article).where(
            Article.id == article_id,
            Article.user_id == user_id,
        )
    )
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


async def use_budget(session: AsyncSession, user_id: UUID, settings: Settings) -> None:
    now = datetime.now(UTC)
    await session.execute(
        insert(ProcessingBudget)
        .values(
            user_id=user_id,
            window_start=now,
            requests=0,
        )
        .on_conflict_do_nothing(index_elements=[ProcessingBudget.user_id])
    )
    budget = await session.scalar(
        select(ProcessingBudget)
        .where(
            ProcessingBudget.user_id == user_id,
        )
        .with_for_update()
    )
    if budget.window_start <= now - timedelta(days=1):
        budget.window_start, budget.requests = now, 0
    if budget.requests >= settings.processing_requests_per_day:
        raise HTTPException(
            status_code=429,
            detail="Your daily processing limit has been reached. Try again tomorrow.",
        )
    budget.requests += 1


async def publish_saved(session: AsyncSession, article: Article) -> None:
    # End the request's transaction before contacting Redis/Valkey.
    await session.flush()
    await session.refresh(article)
    await session.commit()
    try:
        await queue.enqueue_article(article.id)
    except Exception:
        await session.execute(
            update(Article)
            .where(
                Article.id == article.id,
                Article.status == ArticleStatus.PENDING,
            )
            .values(
                status=ArticleStatus.FAILED,
                error_message="The queue is unavailable. Your article is saved; retry later.",
            )
        )
        await session.commit()
        raise HTTPException(
            status_code=503,
            detail="The queue is unavailable. Your article is saved; retry it from the library.",
        ) from None


async def save_article(
    session: AsyncSession, user_id: UUID, url: str, settings: Settings
) -> Article:
    existing = await session.scalar(
        select(Article.id).where(
            Article.user_id == user_id,
            Article.canonical_url == url,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="This article is already saved")
    await use_budget(session, user_id, settings)
    article = Article(user_id=user_id, url=url, canonical_url=url, status=ArticleStatus.PENDING)
    session.add(article)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        cause = getattr(exc.orig, "__cause__", None)
        if getattr(cause, "constraint_name", None) == "uq_articles_user_canonical_url":
            raise HTTPException(status_code=409, detail="This article is already saved") from None
        raise
    await publish_saved(session, article)
    return article


async def retry_article(
    session: AsyncSession, user_id: UUID, article_id: UUID, settings: Settings
) -> Article:
    await owned_article(session, user_id, article_id)
    # The per-user budget lock serializes retry requests and quota consumption.
    await use_budget(session, user_id, settings)
    article = await session.scalar(
        select(Article)
        .where(
            Article.id == article_id,
            Article.user_id == user_id,
        )
        .with_for_update()
    )
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.status != ArticleStatus.FAILED:
        raise HTTPException(
            status_code=409, detail="This article is already processing or complete"
        )
    if article.processing_attempts >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=409, detail="This article has reached its processing retry limit"
        )
    article.status = ArticleStatus.PENDING
    article.error_message = None
    article.available_at = datetime.now(UTC)
    article.lease_token = None
    article.lease_expires_at = None
    await publish_saved(session, article)
    return article
