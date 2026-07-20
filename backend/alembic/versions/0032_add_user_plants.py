"""add user_plants table (Beet-Fundament)

Revision ID: 0032
Revises: 0031
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_plants",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("plant_id", sa.String(20), sa.ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("planted_on", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "plant_id", name="uq_user_plant"),
    )


def downgrade() -> None:
    op.drop_table("user_plants")
