import asyncio
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ArticleStatus
from app.services.extraction import extract_article
from app.services.public_web import ExtractionError


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


async def save_article(
    session: AsyncSession,
    user_id: UUID,
    url: str,
    slots: asyncio.Semaphore,
) -> Article:
    existing = await session.scalar(
        select(Article.id).where(
            Article.user_id == user_id,
            Article.canonical_url == url,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="This article is already saved")
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
    # One bounded request/transaction: cancellation or a crash rolls back the new
    # article instead of leaving a persistent PROCESSING record without a worker.
    try:
        async with asyncio.timeout(20):
            async with slots:
                article.status = ArticleStatus.PROCESSING
                extracted = await extract_article(url)
                article.title = extracted.title
                article.source = extracted.source
                article.content = extracted.content
                article.excerpt = extracted.excerpt
                article.status = ArticleStatus.READY
    except (ExtractionError, TimeoutError) as exc:
        article.status = ArticleStatus.FAILED
        article.error_message = (
            str(exc)
            if isinstance(exc, ExtractionError)
            else ("Processing timed out. Delete this entry and save the URL again to retry.")
        )
    await session.commit()
    await session.refresh(article)
    return article
