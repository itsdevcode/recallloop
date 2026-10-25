"""Deterministic MVP policy, not an implementation of SM-2 or FSRS."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

MAX_INTERVAL_DAYS = 36500


class Rating(StrEnum):
    FORGOT = "FORGOT"
    HARD = "HARD"
    EASY = "EASY"


@dataclass(frozen=True)
class ScheduleState:
    interval_days: int = 0
    repetition_count: int = 0
    ease_factor: Decimal = Decimal("2.50")
    review_count: int = 0


@dataclass(frozen=True)
class ScheduledReview:
    state: ScheduleState
    next_review_at: datetime


def schedule_review(state: ScheduleState, rating: Rating, reviewed_at: datetime) -> ScheduledReview:
    if reviewed_at.tzinfo is None or reviewed_at.utcoffset() is None:
        raise ValueError("Review time must be timezone-aware")
    if not 0 <= state.interval_days <= MAX_INTERVAL_DAYS:
        raise ValueError("Invalid interval")
    if not 0 <= state.repetition_count <= state.review_count:
        raise ValueError("Invalid review counts")
    ease = Decimal(str(state.ease_factor))
    if not ease.is_finite() or not Decimal("1.30") <= ease <= Decimal("3.00"):
        raise ValueError("Ease must be between 1.30 and 3.00")
    now = reviewed_at.astimezone(UTC)
    rating = Rating(rating)
    if rating == Rating.FORGOT:
        new_state = ScheduleState(
            0, 0, max(Decimal("1.30"), ease - Decimal("0.20")), state.review_count + 1
        )
        return ScheduledReview(new_state, now + timedelta(minutes=10))
    if rating == Rating.HARD:
        ease = max(Decimal("1.30"), ease - Decimal("0.15"))
        days = (
            Decimal("1")
            if state.review_count == 0
            else Decimal(state.interval_days) * Decimal("1.2")
        )
    else:
        ease = min(Decimal("3.00"), ease + Decimal("0.10"))
        days = Decimal("3") if state.repetition_count == 0 else Decimal(state.interval_days) * ease
    interval = max(1, min(MAX_INTERVAL_DAYS, int(days.to_integral_value(rounding=ROUND_HALF_UP))))
    return ScheduledReview(
        ScheduleState(interval, state.repetition_count + 1, ease, state.review_count + 1),
        now + timedelta(days=interval),
    )
