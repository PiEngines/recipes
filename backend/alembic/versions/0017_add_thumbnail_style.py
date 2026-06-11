"""add recipes.thumbnail_style

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0015 already adds this column; guard against double-apply so this
    # migration is safe regardless of which revision a given DB came from.
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("recipes")]
    if "thumbnail_style" not in columns:
        op.add_column(
            "recipes",
            sa.Column("thumbnail_style", sa.String(length=20), nullable=False, server_default="crop"),
        )


def downgrade() -> None:
    # Column lifecycle is owned by 0015's downgrade.
    pass
