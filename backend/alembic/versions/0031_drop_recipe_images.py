"""drop dead recipe_images table

Revision ID: 0031
Revises: 0030
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_recipe_images_recipe_id", table_name="recipe_images")
    op.drop_table("recipe_images")


def downgrade() -> None:
    op.create_table(
        "recipe_images",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recipe_images_recipe_id", "recipe_images", ["recipe_id"])
