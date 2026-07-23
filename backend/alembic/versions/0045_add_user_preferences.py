"""add users.preferences + preferences_public (BUG-41)

Revision ID: 0045
Revises: 0044

Zwei neue Spalten am User: die „Vorlieben" als Freitext und ein Schalter, ob
sie auf dem Profil erscheinen. Bestehende User bekommen `preferences = NULL`
und `preferences_public = false` — die Vorlieben sind also standardmäßig leer
und privat.

`server_default` auf der Bool-Spalte, damit der Wert schon während des
Backfills der vorhandenen Zeilen steht und nicht erst der ORM-Default beim
nächsten Schreiben greift.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0045"
down_revision: Union[str, None] = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("preferences", sa.String(length=2000), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "preferences_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "preferences_public")
    op.drop_column("users", "preferences")
