"""add user_plant_task_done table (Beet-Aufgaben Erledigt-Status)

Revision ID: 0034
Revises: 0033
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_plant_task_done",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_plant_id", sa.Integer, sa.ForeignKey("user_plants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("task_key", sa.String(80), nullable=False),
        sa.Column("period_key", sa.String(7), nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_plant_id", "task_key", "period_key", name="uq_user_plant_task_period"),
    )


def downgrade() -> None:
    op.drop_table("user_plant_task_done")
