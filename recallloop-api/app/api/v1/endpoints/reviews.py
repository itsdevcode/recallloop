from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from app.db.session import SessionDep
from app.dependencies.auth import CurrentUser, require_csrf
from app.dependencies.reviews import ReviewTime
from app.schemas.review import (
    CardAnswer,
    DuePage,
    HistoryPage,
    ReviewRequest,
    ReviewResult,
    ReviewSchedule,
    ReviewStats,
)
from app.services import reviews

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/due", response_model=DuePage)
async def due(
    user: CurrentUser,
    session: SessionDep,
    now: ReviewTime,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> DuePage:
    return await reviews.due_cards(session, user.id, now, limit)


@router.get("/cards/{card_id}/answer", response_model=CardAnswer)
async def answer(card_id: UUID, user: CurrentUser, session: SessionDep) -> CardAnswer:
    return await reviews.reveal_answer(session, user.id, card_id)


@router.post("/cards/{card_id}", response_model=ReviewResult, dependencies=[Depends(require_csrf)])
async def submit(
    card_id: UUID,
    data: ReviewRequest,
    user: CurrentUser,
    session: SessionDep,
    now: ReviewTime,
    idempotency_key: Annotated[UUID, Header()],
) -> ReviewResult:
    return await reviews.submit_review(session, user.id, card_id, data.rating, idempotency_key, now)


@router.get("/schedule", response_model=ReviewSchedule)
async def schedule(user: CurrentUser, session: SessionDep, now: ReviewTime) -> ReviewSchedule:
    return await reviews.review_schedule(session, user.id, now)


@router.get("/stats", response_model=ReviewStats)
async def stats(user: CurrentUser, session: SessionDep, now: ReviewTime) -> ReviewStats:
    return await reviews.review_stats(session, user.id, now)


@router.get("/history", response_model=HistoryPage)
async def history(
    user: CurrentUser,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> HistoryPage:
    return await reviews.review_history(session, user.id, limit, offset)
