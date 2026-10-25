from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import defer, selectinload

from app.db.session import SessionDep
from app.dependencies.auth import CurrentUser, SettingsDep, require_csrf
from app.models.article import Article, ArticleStatus
from app.models.learning import Concept
from app.schemas.article import (
    ArticleCreate,
    ArticleDetail,
    ArticlePage,
    ArticleSummary,
    ConceptResponse,
)
from app.services.articles import owned_article, retry_article, save_article

router = APIRouter(prefix="/articles", tags=["articles"])


@router.post(
    "", status_code=202, response_model=ArticleSummary, dependencies=[Depends(require_csrf)]
)
async def create(
    data: ArticleCreate, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> ArticleSummary:
    article = await save_article(session, user.id, data.url, settings)
    return ArticleSummary.model_validate(article)


@router.get("", response_model=ArticlePage)
async def list_articles(
    user: CurrentUser,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    status: ArticleStatus | None = None,
) -> ArticlePage:
    filters = [Article.user_id == user.id]
    if status is not None:
        filters.append(Article.status == status)
    total = await session.scalar(select(func.count()).select_from(Article).where(*filters))
    articles = await session.scalars(
        select(Article)
        .options(defer(Article.content))
        .where(*filters)
        .order_by(
            Article.created_at.desc(),
            Article.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    )
    return ArticlePage(
        items=[ArticleSummary.model_validate(a) for a in articles],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/{article_id}", response_model=ArticleDetail)
async def detail(article_id: UUID, user: CurrentUser, session: SessionDep) -> ArticleDetail:
    return ArticleDetail.model_validate(await owned_article(session, user.id, article_id))


@router.delete("/{article_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def delete(article_id: UUID, user: CurrentUser, session: SessionDep) -> Response:
    await session.delete(await owned_article(session, user.id, article_id))
    await session.commit()
    return Response(status_code=204)


@router.post(
    "/{article_id}/retry",
    status_code=202,
    response_model=ArticleSummary,
    dependencies=[Depends(require_csrf)],
)
async def retry(
    article_id: UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> ArticleSummary:
    return ArticleSummary.model_validate(
        await retry_article(session, user.id, article_id, settings)
    )


@router.get("/{article_id}/concepts", response_model=list[ConceptResponse])
async def concepts(
    article_id: UUID, user: CurrentUser, session: SessionDep
) -> list[ConceptResponse]:
    article = await owned_article(session, user.id, article_id)
    if article.status != ArticleStatus.READY:
        return []
    values = await session.scalars(
        select(Concept)
        .where(Concept.article_id == article_id)
        .options(selectinload(Concept.cards))
        .order_by(Concept.position)
    )
    return [ConceptResponse.model_validate(value) for value in values]
