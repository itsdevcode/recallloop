from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.spaced_repetition import Rating
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.learning import RecallCard


class ReviewLog(Base):
    __tablename__ = "review_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_review_logs_user_key"),
        Index("ix_review_logs_user_reviewed", "user_id", "reviewed_at"),
        CheckConstraint(
            "previous_interval_days >= 0 AND new_interval_days >= 0",
            name="ck_review_logs_intervals",
        ),
        CheckConstraint(
            "review_count >= 1 AND repetition_count >= 0 AND repetition_count <= review_count",
            name="ck_review_logs_counts",
        ),
        CheckConstraint("ease_factor BETWEEN 1.30 AND 3.00", name="ck_review_logs_ease"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    card_id: Mapped[UUID] = mapped_column(
        ForeignKey("recall_cards.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    idempotency_key: Mapped[UUID]
    rating: Mapped[Rating] = mapped_column(
        Enum(Rating, native_enum=False, create_constraint=True, name="review_rating")
    )
    previous_interval_days: Mapped[int] = mapped_column(Integer)
    new_interval_days: Mapped[int] = mapped_column(Integer)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    next_review_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Immutable response snapshots make even much-later HTTP retries return the same result.
    repetition_count: Mapped[int] = mapped_column(Integer)
    ease_factor: Mapped[Decimal] = mapped_column(Numeric(3, 2))
    review_count: Mapped[int] = mapped_column(Integer)
    card: Mapped["RecallCard"] = relationship(back_populates="review_logs")
