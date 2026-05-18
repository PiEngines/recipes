"""extend recipe_access with decline tracking and pagination columns

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-18

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recipe_access", sa.Column("expires_at_individual", sa.DateTime(timezone=True), nullable=True))
    op.add_column("recipe_access", sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("recipe_access", sa.Column("declined_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_recipe_access_declined_by", "recipe_access", "users", ["declined_by"], ["id"]
    )
    op.add_column("recipe_access", sa.Column("page", sa.Integer(), server_default="1", nullable=True))
    op.add_column("recipe_access", sa.Column("page_size", sa.Integer(), server_default="20", nullable=True))
    op.add_column("recipe_access", sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_constraint("fk_recipe_access_declined_by", "recipe_access", type_="foreignkey")
    op.drop_column("recipe_access", "notified_at")
    op.drop_column("recipe_access", "page_size")
    op.drop_column("recipe_access", "page")
    op.drop_column("recipe_access", "declined_by")
    op.drop_column("recipe_access", "declined_at")
    op.drop_column("recipe_access", "expires_at_individual")
