from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.article import ArticleStatus
from app.services.public_web import canonicalize_url


class ArticleCreate(BaseModel):
    url: str = Field(min_length=1, max_length=2048)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        return canonicalize_url(value.strip())


class ArticleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    url: str
    title: str | None
    source: str | None
    excerpt: str | None
    status: ArticleStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    processing_attempts: int
    processing_note: str | None
    ai_model: str | None


class ArticleDetail(ArticleSummary):
    content: str | None


class ArticlePage(BaseModel):
    items: list[ArticleSummary]
    total: int
    limit: int
    offset: int


class CardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    question: str
    answer: str


class ConceptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    explanation: str
    source_excerpt: str
    position: int
    cards: list[CardResponse]
