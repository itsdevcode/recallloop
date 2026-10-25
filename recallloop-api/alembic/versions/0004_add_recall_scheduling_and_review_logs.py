"""add recall scheduling and review logs

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-25 07:36:48.299898

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "review_logs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column(
            "rating",
            sa.Enum(
                "FORGOT",
                "HARD",
                "EASY",
                name="review_rating",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("previous_interval_days", sa.Integer(), nullable=False),
        sa.Column("new_interval_days", sa.Integer(), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("repetition_count", sa.Integer(), nullable=False),
        sa.Column("ease_factor", sa.Numeric(precision=3, scale=2), nullable=False),
        sa.Column("review_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("ease_factor BETWEEN 1.30 AND 3.00", name="ck_review_logs_ease"),
        sa.CheckConstraint(
            "previous_interval_days >= 0 AND new_interval_days >= 0",
            name="ck_review_logs_intervals",
        ),
        sa.CheckConstraint(
            "review_count >= 1 AND repetition_count >= 0 AND repetition_count <= review_count",
            name="ck_review_logs_counts",
        ),
        sa.ForeignKeyConstraint(["card_id"], ["recall_cards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_review_logs_user_key"),
    )
    op.create_index(op.f("ix_review_logs_card_id"), "review_logs", ["card_id"], unique=False)
    op.create_index(
        "ix_review_logs_user_reviewed", "review_logs", ["user_id", "reviewed_at"], unique=False
    )
    op.add_column(
        "recall_cards", sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.execute("UPDATE recall_cards SET next_review_at = created_at")
    op.alter_column(
        "recall_cards",
        "next_review_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    op.add_column(
        "recall_cards", sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "recall_cards", sa.Column("interval_days", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column(
        "recall_cards",
        sa.Column("repetition_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "recall_cards",
        sa.Column(
            "ease_factor", sa.Numeric(precision=3, scale=2), server_default="2.50", nullable=False
        ),
    )
    op.add_column(
        "recall_cards", sa.Column("review_count", sa.Integer(), server_default="0", nullable=False)
    )
    op.create_check_constraint(
        "ck_cards_interval", "recall_cards", "interval_days BETWEEN 0 AND 36500"
    )
    op.create_check_constraint(
        "ck_cards_counts",
        "recall_cards",
        "repetition_count >= 0 AND review_count >= repetition_count",
    )
    op.create_check_constraint("ck_cards_ease", "recall_cards", "ease_factor BETWEEN 1.30 AND 3.00")
    op.create_index("ix_recall_cards_due", "recall_cards", ["next_review_at", "id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_cards_interval", "recall_cards", type_="check")
    op.drop_constraint("ck_cards_counts", "recall_cards", type_="check")
    op.drop_constraint("ck_cards_ease", "recall_cards", type_="check")
    op.drop_index("ix_recall_cards_due", table_name="recall_cards")
    op.drop_column("recall_cards", "review_count")
    op.drop_column("recall_cards", "ease_factor")
    op.drop_column("recall_cards", "repetition_count")
    op.drop_column("recall_cards", "interval_days")
    op.drop_column("recall_cards", "last_reviewed_at")
    op.drop_column("recall_cards", "next_review_at")
    op.drop_index("ix_review_logs_user_reviewed", table_name="review_logs")
    op.drop_index(op.f("ix_review_logs_card_id"), table_name="review_logs")
    op.drop_table("review_logs")
