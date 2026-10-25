from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.core.spaced_repetition import MAX_INTERVAL_DAYS, Rating, ScheduleState, schedule_review

NOW = datetime(2030, 6, 10, 12, 0, 0, 123456, tzinfo=UTC)


def test_forgot_keeps_ten_minute_precision():
    result = schedule_review(ScheduleState(), Rating.FORGOT, NOW)
    assert result.next_review_at == NOW + timedelta(minutes=10)
    assert result.state == ScheduleState(0, 0, Decimal("2.30"), 1)


@pytest.mark.parametrize(
    "rating,days,ease",
    [
        (Rating.HARD, 1, "2.35"),
        (Rating.EASY, 3, "2.60"),
    ],
)
def test_first_successful_review(rating, days, ease):
    result = schedule_review(ScheduleState(), rating, NOW)
    assert result.next_review_at == NOW + timedelta(days=days)
    assert result.state == ScheduleState(days, 1, Decimal(ease), 1)


def test_easy_uses_updated_ease_and_half_up_rounding():
    result = schedule_review(ScheduleState(3, 1, Decimal("2.40"), 1), Rating.EASY, NOW)
    assert result.state.interval_days == 8  # 3 * 2.50 = 7.50 -> 8
    result = schedule_review(ScheduleState(2, 1, Decimal("2.50"), 1), Rating.HARD, NOW)
    assert result.state.interval_days == 2  # 2.4 -> 2


def test_forgot_resets_success_sequence_and_easy_restarts_three_days():
    result = schedule_review(ScheduleState(20, 3, Decimal("2.50"), 4), Rating.FORGOT, NOW)
    assert result.state.repetition_count == 0
    easy = schedule_review(result.state, Rating.EASY, NOW + timedelta(minutes=10))
    assert easy.state.interval_days == 3 and easy.state.review_count == 6


@pytest.mark.parametrize("rating", list(Rating))
def test_repeated_ratings_respect_bounds_and_future_dates(rating):
    state, now = ScheduleState(), NOW
    for _ in range(50):
        result = schedule_review(state, rating, now)
        assert Decimal("1.30") <= result.state.ease_factor <= Decimal("3.00")
        assert 0 <= result.state.interval_days <= MAX_INTERVAL_DAYS
        assert result.next_review_at > now
        state, now = result.state, result.next_review_at
    assert state.ease_factor == (Decimal("3.00") if rating == Rating.EASY else Decimal("1.30"))


def test_aware_times_are_normalized_to_utc_and_naive_times_rejected():
    offset = NOW.astimezone(timezone(timedelta(hours=5, minutes=30)))
    assert schedule_review(
        ScheduleState(), Rating.FORGOT, offset
    ).next_review_at == NOW + timedelta(minutes=10)
    assert schedule_review(ScheduleState(), Rating.HARD, offset).next_review_at.tzinfo == UTC
    with pytest.raises(ValueError):
        schedule_review(ScheduleState(), Rating.EASY, NOW.replace(tzinfo=None))


@pytest.mark.parametrize(
    "state",
    [
        ScheduleState(-1),
        ScheduleState(repetition_count=-1),
        ScheduleState(repetition_count=2, review_count=1),
        ScheduleState(ease_factor=Decimal("1.29")),
        ScheduleState(ease_factor=Decimal("NaN")),
    ],
)
def test_invalid_state_is_rejected(state):
    with pytest.raises(ValueError):
        schedule_review(state, Rating.EASY, NOW)
