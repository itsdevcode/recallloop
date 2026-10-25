from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.spaced_repetition import Rating


class DueCard(BaseModel):
    card_id: UUID
    question: str
    article_title: str | None
    concept_title: str
    next_review_at: datetime


class DuePage(BaseModel):
    items: list[DueCard]
    total_due: int
    limit: int
    as_of: datetime


class CardAnswer(BaseModel):
    card_id: UUID
    answer: str


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rating: Rating


class ReviewResult(BaseModel):
    review_log_id: UUID
    card_id: UUID
    rating: Rating
    reviewed_at: datetime
    next_review_at: datetime
    interval_days: int
    repetition_count: int
    ease_factor: float
    review_count: int


class ScheduleDay(BaseModel):
    date: date
    count: int


class ReviewSchedule(BaseModel):
    as_of: datetime
    overdue: int
    due_today: int
    upcoming: list[ScheduleDay]


class ReviewStats(BaseModel):
    as_of: datetime
    total_cards: int
    due_now: int
    reviewed_today: int
    total_completed_reviews: int
    upcoming_next_7_days: int
    next_review_at: datetime | None


class HistoryEntry(BaseModel):
    id: UUID
    card_id: UUID
    question: str
    article_title: str | None
    rating: Rating
    reviewed_at: datetime
    next_review_at: datetime


class HistoryPage(BaseModel):
    items: list[HistoryEntry]
    total: int
    limit: int
    offset: int
