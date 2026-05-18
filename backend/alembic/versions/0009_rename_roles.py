"""rename roles to german names

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-18

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new enum values (must run in autocommit mode for PostgreSQL)
    with op.get_context().autocommit_block():
        op.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'chefkoch'"))
        op.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'koch'"))
        op.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'kuechenhilfe'"))

    # 2. Convert column to VARCHAR, migrate data, convert back
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20)"))
    op.execute(sa.text("UPDATE users SET role='chefkoch' WHERE role='admin'"))
    op.execute(sa.text("UPDATE users SET role='koch' WHERE role='autor'"))
    op.execute(sa.text("UPDATE users SET role='kuechenhilfe' WHERE role='leser'"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role"))


def downgrade() -> None:
    # Reverse the data migration (cannot remove enum values in PostgreSQL)
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20)"))
    op.execute(sa.text("UPDATE users SET role='admin' WHERE role='chefkoch'"))
    op.execute(sa.text("UPDATE users SET role='autor' WHERE role='koch'"))
    op.execute(sa.text("UPDATE users SET role='leser' WHERE role='kuechenhilfe'"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role"))
