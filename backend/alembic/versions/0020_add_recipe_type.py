"""add recipes.type

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recipes",
        sa.Column("type", sa.String(10), nullable=False, server_default="kochen"),
    )
    op.create_check_constraint(
        "ck_recipes_type",
        "recipes",
        "type IN ('kochen', 'backen')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_recipes_type", "recipes", type_="check")
    op.drop_column("recipes", "type")
