"""add recipe_serve_with table

Revision ID: 0025
Revises: 0024
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recipe_serve_with",
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("serve_with_recipe_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["serve_with_recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("recipe_id", "serve_with_recipe_id"),
    )
    op.create_index("ix_recipe_serve_with_recipe_id", "recipe_serve_with", ["recipe_id"])


def downgrade() -> None:
    op.drop_index("ix_recipe_serve_with_recipe_id", table_name="recipe_serve_with")
    op.drop_table("recipe_serve_with")
