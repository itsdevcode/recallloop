"""Short transactions and fenced leases keep broker delivery at-least-once safe."""

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.gemma import AIError, TransientAIError, generate_learning
from app.core.config import LEASE_SECONDS, MAX_ATTEMPTS, Settings
from app.models import Article, Concept, RecallCard
from app.models.article import ArticleStatus
from app.services.extraction import extract_article
from app.services.public_web import ExtractionError, TransientExtractionError


@dataclass
class Outcome:
    state: str
    retry_delay: int = 0


async def process_article(
    article_id: UUID,
    sessions: async_sessionmaker,
    settings: Settings,
) -> Outcome:
    now = datetime.now(UTC)
    token = uuid4()
    async with sessions.begin() as session:
        article = await session.scalar(
            select(Article).where(Article.id == article_id).with_for_update()
        )
        if article is None or article.status in {ArticleStatus.READY, ArticleStatus.FAILED}:
            return Outcome("ignored")
        if (
            article.status == ArticleStatus.PROCESSING
            and article.lease_expires_at
            and article.lease_expires_at > now
        ):
            return Outcome("ignored")
        if article.available_at > now:
            return Outcome("ignored")
        if article.processing_attempts >= MAX_ATTEMPTS:
            article.status = ArticleStatus.FAILED
            article.error_message = "Processing reached its retry limit. Please contact support."
            article.lease_token = None
            article.lease_expires_at = None
            return Outcome("failed")
        article.status = ArticleStatus.PROCESSING
        article.processing_attempts += 1
        article.lease_token = token
        article.lease_expires_at = now + timedelta(seconds=LEASE_SECONDS)
        article.error_message = None
        url, content, attempt = article.url, article.content, article.processing_attempts
    # No session or transaction is open during HTTP fetching, parsing or inference.
    owned = [
        Article.id == article_id,
        Article.lease_token == token,
        Article.status == ArticleStatus.PROCESSING,
    ]
    try:
        async with asyncio.timeout(95):
            if not content:
                extracted = await extract_article(url)
                content = extracted.content
                async with sessions.begin() as session:
                    result = await session.execute(
                        update(Article)
                        .where(*owned)
                        .values(
                            title=extracted.title,
                            source=extracted.source,
                            content=content,
                            excerpt=extracted.excerpt,
                        )
                    )
                    if not result.rowcount:
                        return Outcome("ignored")
            generated = await generate_learning(content, settings)
            async with sessions.begin() as session:
                article = await session.scalar(select(Article).where(*owned).with_for_update())
                if article is None:
                    return Outcome("ignored")
                # Atomic replacement and the article lease fence prevent retry duplicates.
                await session.execute(delete(Concept).where(Concept.article_id == article_id))
                for position, data in enumerate(generated.learning.concepts):
                    concept = Concept(
                        article_id=article_id,
                        title=data.title,
                        explanation=data.explanation,
                        source_excerpt=data.source_excerpt,
                        position=position,
                    )
                    concept.cards = [RecallCard(question=data.question, answer=data.answer)]
                    session.add(concept)
                article.status = ArticleStatus.READY
                article.ai_model = settings.gemma_model
                article.processing_note = generated.coverage_note
                article.error_message = None
                article.lease_token = None
                article.lease_expires_at = None
            return Outcome("ready")
    except (AIError, ExtractionError, TimeoutError) as exc:
        transient = isinstance(exc, (TransientAIError, TransientExtractionError, TimeoutError))
        delay = 5 * 2 ** (attempt - 1) if transient and attempt < MAX_ATTEMPTS else 0
        message = (
            "Processing was temporarily interrupted. It will retry."
            if delay
            else "Processing could not be completed. Retry this article if attempts remain."
        )
        if isinstance(exc, ExtractionError):
            message = str(exc)  # The extractor emits only predefined safe messages.
        async with sessions.begin() as session:
            await session.execute(
                update(Article)
                .where(*owned)
                .values(
                    status=ArticleStatus.PENDING if delay else ArticleStatus.FAILED,
                    error_message=message,
                    lease_token=None,
                    lease_expires_at=None,
                    available_at=datetime.now(UTC) + timedelta(seconds=delay),
                )
            )
        return Outcome("retry" if delay else "failed", delay)
    except Exception:
        # Never let SDK/DB exceptions carry article text or secrets into Celery tracebacks.
        # If the database is unavailable, the lease expires and reconciliation recovers it.
        try:
            async with sessions.begin() as session:
                await session.execute(
                    update(Article)
                    .where(*owned)
                    .values(
                        status=ArticleStatus.FAILED,
                        error_message="Processing was interrupted. You can retry this article.",
                        lease_token=None,
                        lease_expires_at=None,
                    )
                )
        except Exception:
            pass
        return Outcome("failed")
