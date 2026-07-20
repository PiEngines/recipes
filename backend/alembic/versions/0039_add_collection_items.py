"""add collections.visibility + collection_items (Mixed Collections)

Revision ID: 0039
Revises: 0038

`collection_recipes` bleibt unangetastet (deprecated) — es gab nie eine API,
die dort geschrieben hätte, daher keine Datenmigration.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "collections",
        sa.Column("visibility", sa.String(10), nullable=False, server_default="private"),
    )
    op.create_table(
        "collection_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("collection_id", sa.Integer, sa.ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_type", sa.String(20), nullable=False),
        # Kein FK: die Referenz ist polymorph, Existenz wird App-seitig geprüft.
        sa.Column("item_id", sa.Integer, nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("collection_id", "item_type", "item_id", name="uq_collection_item"),
    )


def downgrade() -> None:
    op.drop_table("collection_items")
    op.drop_column("collections", "visibility")
