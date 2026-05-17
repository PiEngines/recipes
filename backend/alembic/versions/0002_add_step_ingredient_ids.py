"""add ingredient_ids to recipe_steps

Revision ID: 0002
Revises: 0001
Create Date: 2025-05-17 01:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipe_steps", sa.Column("ingredient_ids", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("recipe_steps", "ingredient_ids")
