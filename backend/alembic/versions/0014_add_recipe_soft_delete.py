"""add index for recipe soft-delete trash queries

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-21 00:00:00.000000

Note: deleted_at column already added in 0008; this migration adds an index
to speed up trash queries (filter on deleted_at IS NOT NULL).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_recipes_deleted_at", "recipes", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_recipes_deleted_at", table_name="recipes")
