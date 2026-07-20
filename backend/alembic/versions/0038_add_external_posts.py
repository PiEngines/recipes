"""add external_posts table (Instagram/TikTok-Verlinkungen)

Revision ID: 0038
Revises: 0037
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "external_posts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        # platform bewusst String + Python-Enum (Muster wie recipes.type):
        # neue Plattformen brauchen so keine Enum-Migration.
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        # Cache-/Ableitungsfelder — bleiben in F3a leer, gefüllt erst in F3b.
        sa.Column("oembed_html", sa.Text, nullable=True),
        sa.Column("thumbnail_url", sa.String(1000), nullable=True),
        sa.Column("author_name", sa.String(255), nullable=True),
        sa.Column("caption_text", sa.Text, nullable=True),
        sa.Column("extracted_ingredients", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("external_posts")
