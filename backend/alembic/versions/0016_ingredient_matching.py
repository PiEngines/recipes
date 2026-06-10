"""add ingredient matching support: recipe_steps.ingredient_ids_auto,
ingredients.bls_id, recipes.matching_reviewed_at

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-10 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipe_steps", sa.Column("ingredient_ids_auto", JSONB(), nullable=True))
    op.add_column("ingredients", sa.Column("bls_id", sa.String(length=50), nullable=True))
    op.add_column("recipes", sa.Column("matching_reviewed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("recipes", "matching_reviewed_at")
    op.drop_column("ingredients", "bls_id")
    op.drop_column("recipe_steps", "ingredient_ids_auto")
