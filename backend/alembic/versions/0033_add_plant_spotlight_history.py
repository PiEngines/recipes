"""add plant_spotlight_history table (Kraut des Monats)

Revision ID: 0033
Revises: 0032
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plant_spotlight_history",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("plant_id", sa.String(20), sa.ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("period_key", sa.String(7), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("period_key", name="uq_spotlight_period"),
    )


def downgrade() -> None:
    op.drop_table("plant_spotlight_history")
