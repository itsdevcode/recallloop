from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import defer

from app.db.session import SessionDep
from app.dependencies.auth import CurrentUser, require_csrf
from app.models.article import Article, ArticleStatus
from app.schemas.article import ArticleCreate, ArticleDetail, ArticlePage, ArticleSummary
from app.services.articles import owned_article, save_article

router = APIRouter(prefix="/articles", tags=["articles"])


@router.post(
    "", status_code=201, response_model=ArticleSummary, dependencies=[Depends(require_csrf)]
)
async def create(
    data: ArticleCreate, user: CurrentUser, session: SessionDep, request: Request
) -> ArticleSummary:
    article = await save_article(session, user.id, data.url, request.app.state.extraction_slots)
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
