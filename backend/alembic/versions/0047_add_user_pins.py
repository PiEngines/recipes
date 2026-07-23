"""profil pins: user_pins table (Ü18)

Revision ID: 0047
Revises: 0046

Bis zu drei angepinnte Rezepte und drei Beiträge je User — die Highlights im
Profilkopf. Polymorph wie `collection_items`: `item_id` ohne Fremdschlüssel,
die Existenz wird App-seitig geprüft. Der 3er-Deckel je Typ sitzt im Endpoint.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0047"
down_revision: Union[str, None] = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_pins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("item_type", sa.String(length=20), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "item_type", "item_id", name="uq_user_pin"),
    )
    op.create_index("ix_user_pins_user_id", "user_pins", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_pins_user_id", table_name="user_pins")
    op.drop_table("user_pins")
