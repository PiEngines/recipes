"""add recipes.seasonal_tags

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recipes",
        sa.Column("seasonal_tags", sa.ARRAY(sa.String()), nullable=True, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("recipes", "seasonal_tags")
