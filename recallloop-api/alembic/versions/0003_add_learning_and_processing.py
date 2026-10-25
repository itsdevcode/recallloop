"""add learning materials and processing leases

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-25 06:52:52.071992

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "processing_budgets",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requests", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "concepts",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("article_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("source_excerpt", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("article_id", "position", name="uq_concepts_article_position"),
    )
    op.create_index(op.f("ix_concepts_article_id"), "concepts", ["article_id"], unique=False)
    op.create_table(
        "recall_cards",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("concept_id", sa.Uuid(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["concept_id"], ["concepts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_recall_cards_concept_id"), "recall_cards", ["concept_id"], unique=False
    )
    op.add_column(
        "articles",
        sa.Column("processing_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("articles", sa.Column("lease_token", sa.Uuid(), nullable=True))
    op.add_column(
        "articles", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "articles",
        sa.Column(
            "available_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column("articles", sa.Column("ai_model", sa.String(length=100), nullable=True))
    op.add_column("articles", sa.Column("processing_note", sa.Text(), nullable=True))
    op.create_index("ix_articles_recovery", "articles", ["status", "updated_at"], unique=False)
    # PR #3 READY means extracted, not AI-complete. Preserve text and queue generation.
    op.execute("UPDATE articles SET status = 'PENDING' WHERE status = 'READY'")


def downgrade() -> None:
    """Downgrade schema."""
    # Restore extraction-era meaning when rolling back the AI feature.
    op.execute(
        "UPDATE articles SET status = CASE WHEN content IS NOT NULL "
        "THEN 'READY' ELSE 'FAILED' END WHERE status IN ('PENDING', 'PROCESSING')"
    )
    op.drop_index("ix_articles_recovery", table_name="articles")
    op.drop_column("articles", "processing_note")
    op.drop_column("articles", "ai_model")
    op.drop_column("articles", "available_at")
    op.drop_column("articles", "lease_expires_at")
    op.drop_column("articles", "lease_token")
    op.drop_column("articles", "processing_attempts")
    op.drop_index(op.f("ix_recall_cards_concept_id"), table_name="recall_cards")
    op.drop_table("recall_cards")
    op.drop_index(op.f("ix_concepts_article_id"), table_name="concepts")
    op.drop_table("concepts")
    op.drop_table("processing_budgets")
