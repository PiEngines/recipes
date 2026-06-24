"""add module fields to recipe_components

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipe_components", sa.Column("servings_override", sa.Integer(), nullable=True))
    op.add_column("recipe_components", sa.Column("scale_factor", sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column("recipe_components", sa.Column("referenced_version_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_recipe_components_referenced_version_id",
        "recipe_components",
        "recipe_versions",
        ["referenced_version_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_recipe_components_referenced_version_id", "recipe_components", type_="foreignkey")
    op.drop_column("recipe_components", "referenced_version_id")
    op.drop_column("recipe_components", "scale_factor")
    op.drop_column("recipe_components", "servings_override")
