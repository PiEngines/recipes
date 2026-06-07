"""add username/avatar to users, difficulty default + thumbnail_style on recipes,
create user_favorites, user_recipe_history, recipe_comments

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-07 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users: username + avatar_url ──────────────────────────────────────────
    op.add_column("users", sa.Column("username", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(500), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # ── recipes: difficulty NOT NULL DEFAULT 3, thumbnail_style ───────────────
    op.execute("UPDATE recipes SET difficulty = 3 WHERE difficulty IS NULL")
    op.alter_column(
        "recipes",
        "difficulty",
        existing_type=sa.Integer(),
        nullable=False,
        server_default=sa.text("3"),
    )
    op.add_column(
        "recipes",
        sa.Column("thumbnail_style", sa.String(20), nullable=False, server_default="crop"),
    )

    # ── user_favorites ─────────────────────────────────────────────────────────
    op.create_table(
        "user_favorites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── user_recipe_history ────────────────────────────────────────────────────
    op.create_table(
        "user_recipe_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── recipe_comments ────────────────────────────────────────────────────────
    op.create_table(
        "recipe_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="approved"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("recipe_comments")
    op.drop_table("user_recipe_history")
    op.drop_table("user_favorites")

    op.drop_column("recipes", "thumbnail_style")
    op.alter_column(
        "recipes",
        "difficulty",
        existing_type=sa.Integer(),
        nullable=True,
        server_default=None,
    )

    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "username")
