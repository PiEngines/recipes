"""extend recipe_versions and recipes tables

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend recipe_versions
    op.add_column("recipe_versions", sa.Column("changed_fields_count", sa.Integer(), nullable=True))
    op.add_column("recipe_versions", sa.Column("changed_chars_count", sa.Integer(), nullable=True))
    op.add_column(
        "recipe_versions",
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )

    # Extend recipes
    op.add_column("recipes", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "recipes",
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.add_column(
        "recipes",
        sa.Column("pending_version_id", sa.Integer(), sa.ForeignKey("recipe_versions.id"), nullable=True),
    )
    op.add_column(
        "recipes",
        sa.Column("review_status", sa.String(20), nullable=False, server_default="none"),
    )

    # Migrate existing data: set author_id = created_by
    op.execute("UPDATE recipes SET author_id = created_by")

    # Add index on review_status
    op.create_index("ix_recipes_review_status", "recipes", ["review_status"])


def downgrade() -> None:
    op.drop_index("ix_recipes_review_status", table_name="recipes")
    op.drop_column("recipes", "review_status")
    op.drop_column("recipes", "pending_version_id")
    op.drop_column("recipes", "author_id")
    op.drop_column("recipes", "deleted_at")
    op.drop_column("recipe_versions", "created_by")
    op.drop_column("recipe_versions", "changed_chars_count")
    op.drop_column("recipe_versions", "changed_fields_count")
