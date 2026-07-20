"""add user_follows table (Follow-Graph)

Revision ID: 0037
Revises: 0036
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0037"
down_revision: Union[str, None] = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_follows",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("follower_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("followee_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("follower_id", "followee_id", name="uq_user_follow"),
    )


def downgrade() -> None:
    op.drop_table("user_follows")
