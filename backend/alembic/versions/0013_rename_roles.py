"""rename roles: chefkoch→kuechenchef, koch→chefkoch, kuechenhilfe→koch

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-19

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new enum value 'kuechenchef' (must run in autocommit for PostgreSQL)
    with op.get_context().autocommit_block():
        op.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'kuechenchef'"))

    # 2. Migrate data via VARCHAR cast (order matters — no intermediate conflicts)
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20)"))
    # chefkoch → kuechenchef (must happen first, before koch→chefkoch)
    op.execute(sa.text("UPDATE users SET role='kuechenchef' WHERE role='chefkoch'"))
    # koch → chefkoch
    op.execute(sa.text("UPDATE users SET role='chefkoch' WHERE role='koch'"))
    # kuechenhilfe → koch (kuechenhilfe remains a valid enum value for new users)
    op.execute(sa.text("UPDATE users SET role='koch' WHERE role='kuechenhilfe'"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role"))


def downgrade() -> None:
    # Reverse data migration (cannot remove enum values in PostgreSQL)
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20)"))
    op.execute(sa.text("UPDATE users SET role='kuechenhilfe' WHERE role='koch'"))
    op.execute(sa.text("UPDATE users SET role='koch' WHERE role='chefkoch'"))
    op.execute(sa.text("UPDATE users SET role='chefkoch' WHERE role='kuechenchef'"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role"))
