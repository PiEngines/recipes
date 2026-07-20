"""add shopping_list_items table (Einkaufsliste v1)

Revision ID: 0035
Revises: 0034
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shopping_list_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("recipe_id", sa.Integer, sa.ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recipe_title", sa.String(255), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("amount", sa.String(100), nullable=True),
        sa.Column("unit", sa.String(100), nullable=True),
        sa.Column("checked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("shopping_list_items")
