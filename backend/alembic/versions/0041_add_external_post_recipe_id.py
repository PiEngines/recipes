"""add external_posts.recipe_id (Post <-> Rezept-Verknüpfung)

Revision ID: 0041
Revises: 0040

Additiv: ein Post zeigt auf höchstens ein Rezept, ein Rezept kann von vielen
Posts referenziert werden. `ondelete=SET NULL`, damit ein gelöschtes Rezept die
verlinkten Beiträge nicht mitreisst — die Verknüpfung fällt weg, der Beitrag
bleibt.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0041"
down_revision: Union[str, None] = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "external_posts",
        sa.Column("recipe_id", sa.Integer, nullable=True),
    )
    op.create_foreign_key(
        "fk_external_posts_recipe_id",
        "external_posts",
        "recipes",
        ["recipe_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_external_posts_recipe_id", "external_posts", ["recipe_id"])


def downgrade() -> None:
    op.drop_index("ix_external_posts_recipe_id", table_name="external_posts")
    op.drop_constraint("fk_external_posts_recipe_id", "external_posts", type_="foreignkey")
    op.drop_column("external_posts", "recipe_id")
