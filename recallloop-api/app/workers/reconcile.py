"""Recover a lost queue or an interrupted worker from durable PostgreSQL state."""

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import LEASE_SECONDS, MAX_ATTEMPTS, get_settings
from app.models.article import Article, ArticleStatus
from app.services import queue


async def reconcile(sessions: async_sessionmaker) -> int:
    now = datetime.now(UTC)
    async with sessions.begin() as session:
        articles = (
            await session.scalars(
                select(Article)
                .where(
                    or_(
                        and_(
                            Article.status == ArticleStatus.PENDING,
                            Article.available_at <= now,
                            Article.updated_at < now - timedelta(seconds=LEASE_SECONDS),
                        ),
                        and_(
                            Article.status == ArticleStatus.PROCESSING,
                            or_(
                                Article.lease_expires_at <= now, Article.lease_expires_at.is_(None)
                            ),
                        ),
                    )
                )
                .order_by(Article.updated_at)
                .limit(100)
                .with_for_update(skip_locked=True)
            )
        ).all()
        identifiers = []
        for article in articles:
            article.lease_token = None
            article.lease_expires_at = None
            if article.processing_attempts >= MAX_ATTEMPTS:
                article.status = ArticleStatus.FAILED
                article.error_message = "Processing reached its retry limit after an interruption."
            else:
                article.status = ArticleStatus.PENDING
                article.updated_at = now
                article.available_at = now
                article.error_message = "Processing is queued again after an interruption."
                identifiers.append(article.id)
    # No transaction spans broker publishing; timestamp fencing bounds re-publication.
    for article_id in identifiers:
        try:
            await queue.enqueue_article(article_id)
        except Exception:
            break  # Broker down: remaining PENDING rows are eligible after the stale interval.
    return len(identifiers)


async def run() -> int:
    settings = get_settings()
    engine = create_async_engine(
        settings.async_database_url,
        poolclass=NullPool,
        hide_parameters=True,
        connect_args={"timeout": 5, "command_timeout": 10},
    )
    try:
        return await reconcile(async_sessionmaker(engine, expire_on_commit=False))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    print(f"Reconciled {asyncio.run(run())} article jobs")
