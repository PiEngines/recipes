"""add title and timer_label to recipe_steps

Revision ID: 0003
Revises: 0002
Create Date: 2025-05-17 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipe_steps", sa.Column("title", sa.String(255), nullable=True))
    op.add_column("recipe_steps", sa.Column("timer_label", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("recipe_steps", "timer_label")
    op.drop_column("recipe_steps", "title")
