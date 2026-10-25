from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.article import Article
    from app.models.review import ReviewLog


class Concept(Base):
    __tablename__ = "concepts"
    __table_args__ = (
        UniqueConstraint("article_id", "position", name="uq_concepts_article_position"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    article_id: Mapped[UUID] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    explanation: Mapped[str] = mapped_column(Text)
    source_excerpt: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    article: Mapped["Article"] = relationship(back_populates="concepts")
    cards: Mapped[list["RecallCard"]] = relationship(
        back_populates="concept",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class RecallCard(Base):
    __tablename__ = "recall_cards"
    __table_args__ = (
        CheckConstraint("interval_days BETWEEN 0 AND 36500", name="ck_cards_interval"),
        CheckConstraint(
            "repetition_count >= 0 AND review_count >= repetition_count", name="ck_cards_counts"
        ),
        CheckConstraint("ease_factor BETWEEN 1.30 AND 3.00", name="ck_cards_ease"),
        Index("ix_recall_cards_due", "next_review_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    concept_id: Mapped[UUID] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), index=True
    )
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    concept: Mapped[Concept] = relationship(back_populates="cards")
    next_review_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    interval_days: Mapped[int] = mapped_column(Integer, server_default="0")
    repetition_count: Mapped[int] = mapped_column(Integer, server_default="0")
    ease_factor: Mapped[Decimal] = mapped_column(Numeric(3, 2), server_default="2.50")
    review_count: Mapped[int] = mapped_column(Integer, server_default="0")
    review_logs: Mapped[list["ReviewLog"]] = relationship(
        back_populates="card",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ProcessingBudget(Base):
    """Survives article deletion so deleting/re-saving cannot bypass the daily quota."""

    __tablename__ = "processing_budgets"
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    requests: Mapped[int] = mapped_column(Integer)
