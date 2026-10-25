from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.article import Article


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
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    concept_id: Mapped[UUID] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), index=True
    )
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    concept: Mapped[Concept] = relationship(back_populates="cards")


class ProcessingBudget(Base):
    """Survives article deletion so deleting/re-saving cannot bypass the daily quota."""

    __tablename__ = "processing_budgets"
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    requests: Mapped[int] = mapped_column(Integer)
