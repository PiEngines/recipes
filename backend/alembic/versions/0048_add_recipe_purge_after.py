"""recipes.purge_after: Retention-Frist für endgültig gelöschte Rezepte (Ü23)

Revision ID: 0048
Revises: 0047

Additive, nullable Timestamp-Spalte. Beim „endgültigen" Löschen wird sie auf
jetzt + 30 Tage gesetzt; bis dahin bleibt die Zeile als Titel-Tombstone stehen
(Medien sind da schon freigegeben), danach räumt der Lazy-Purge sie hart weg.
NULL = kein Purge geplant (aktives Rezept oder nur im Papierkorb).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0048"
down_revision: Union[str, None] = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "recipes",
        sa.Column("purge_after", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("recipes", "purge_after")
