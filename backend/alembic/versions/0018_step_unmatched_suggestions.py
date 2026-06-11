"""add step_unmatched_suggestions table

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "step_unmatched_suggestions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.Integer(), sa.ForeignKey("recipe_steps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("bls_id", sa.String(length=50), nullable=False),
        sa.Column("bls_name", sa.String(length=255), nullable=False),
        sa.Column("confidence", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_step_unmatched_suggestions_recipe_id",
        "step_unmatched_suggestions",
        ["recipe_id"],
    )
    op.create_index(
        "ix_step_unmatched_suggestions_step_id",
        "step_unmatched_suggestions",
        ["step_id"],
    )
    op.create_index(
        "ix_step_unmatched_suggestions_lookup",
        "step_unmatched_suggestions",
        ["recipe_id", "step_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_step_unmatched_suggestions_lookup", table_name="step_unmatched_suggestions")
    op.drop_index("ix_step_unmatched_suggestions_step_id", table_name="step_unmatched_suggestions")
    op.drop_index("ix_step_unmatched_suggestions_recipe_id", table_name="step_unmatched_suggestions")
    op.drop_table("step_unmatched_suggestions")
