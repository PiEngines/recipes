"""extend users table with new columns and roles

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to users
    op.add_column("users", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("email_notifications", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column("users", sa.Column("dark_mode_preference", sa.String(10), nullable=True))
    op.add_column(
        "users",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )

    # Step 1: extend enum in its own autocommit block — new values must be
    # committed before they can be referenced in DML statements
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'autor'")
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'leser'")

    # Step 2: migrate existing data (new transaction, enum values now visible)
    op.execute("UPDATE users SET role='autor' WHERE role='full'")
    op.execute("UPDATE users SET role='leser' WHERE role='limited'")
    op.execute("UPDATE users SET role='leser' WHERE role='single'")
    op.execute("UPDATE users SET role='leser' WHERE role='user'")


def downgrade() -> None:
    op.drop_column("users", "status")
    op.drop_column("users", "dark_mode_preference")
    op.drop_column("users", "email_notifications")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "updated_at")
    # Note: cannot remove enum values in PostgreSQL
