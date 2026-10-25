import asyncio
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.services.article_processing import process_article
from app.workers.celery_app import celery_app


async def run_article(article_id: UUID):
    settings = get_settings()
    engine = create_async_engine(
        settings.async_database_url,
        poolclass=NullPool,
        hide_parameters=True,
        connect_args={"timeout": 5, "command_timeout": 10},
    )
    try:
        return await process_article(
            article_id, async_sessionmaker(engine, expire_on_commit=False), settings
        )
    finally:
        await engine.dispose()


@celery_app.task(bind=True, name="recallloop.process_article", max_retries=2, ignore_result=True)
def process_article_task(self, article_id: str) -> None:
    try:
        identifier = UUID(article_id)
    except ValueError:
        return
    try:
        outcome = asyncio.run(run_article(identifier))
    except Exception:
        logging.getLogger(__name__).warning(
            "Article processing interrupted; durable state will be reconciled"
        )
        return
    if outcome.state == "retry":
        # Database attempt limits remain authoritative across redelivery/reconciliation.
        raise self.retry(countdown=outcome.retry_delay, exc=None)
