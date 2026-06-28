"""extend recipes.type to String(20) with additional types

Revision ID: 0023
Revises: 0022
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_recipes_type", "recipes", type_="check")
    op.alter_column(
        "recipes", "type",
        type_=sa.String(20),
        existing_type=sa.String(10),
        existing_nullable=False,
        existing_server_default="kochen",
    )
    op.create_check_constraint(
        "ck_recipes_type",
        "recipes",
        "type IN ('kochen', 'backen', 'grillen', 'braten', 'daempfen', 'einkochen', 'rohkost')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_recipes_type", "recipes", type_="check")
    op.alter_column(
        "recipes", "type",
        type_=sa.String(10),
        existing_type=sa.String(20),
        existing_nullable=False,
        existing_server_default="kochen",
    )
    op.create_check_constraint(
        "ck_recipes_type",
        "recipes",
        "type IN ('kochen', 'backen')",
    )
