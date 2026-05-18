"""add is_pending_review to recipe_access, notified_at to recipe_versions

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-18

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "recipe_access",
        sa.Column("is_pending_review", sa.Boolean(), nullable=True, server_default=sa.text("false")),
    )
    op.add_column(
        "recipe_versions",
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("recipe_versions", "notified_at")
    op.drop_column("recipe_access", "is_pending_review")
