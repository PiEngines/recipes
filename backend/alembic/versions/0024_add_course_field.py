"""add recipes.course field

Revision ID: 0024
Revises: 0023
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recipes",
        sa.Column("course", sa.String(50), nullable=True),
    )
    op.create_check_constraint(
        "ck_recipes_course",
        "recipes",
        "course IS NULL OR course IN ('vorspeise', 'hauptspeise', 'beilage', 'dessert', 'snack', 'gebaeck', 'suppe', 'fruehstueck')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_recipes_course", "recipes", type_="check")
    op.drop_column("recipes", "course")
