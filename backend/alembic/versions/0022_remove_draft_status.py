"""remove draft status — all recipes are now published

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE recipes SET status = 'published' WHERE status = 'draft'")
    op.execute("ALTER TABLE recipes ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE recipes ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("DROP TYPE recipe_status")
    op.execute("CREATE TYPE recipe_status AS ENUM ('published')")
    op.execute("ALTER TABLE recipes ALTER COLUMN status TYPE recipe_status USING status::recipe_status")
    op.execute("ALTER TABLE recipes ALTER COLUMN status SET DEFAULT 'published'")


def downgrade() -> None:
    op.execute("ALTER TABLE recipes ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE recipes ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("DROP TYPE recipe_status")
    op.execute("CREATE TYPE recipe_status AS ENUM ('draft', 'published')")
    op.execute("ALTER TABLE recipes ALTER COLUMN status TYPE recipe_status USING status::recipe_status")
    op.execute("ALTER TABLE recipes ALTER COLUMN status SET DEFAULT 'draft'")
