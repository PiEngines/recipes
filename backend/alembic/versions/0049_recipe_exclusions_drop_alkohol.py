"""recipe_exclusions M2M + „Alkohol" aus der Ausschluss-Taxonomie raus (Ü25)

Revision ID: 0049
Revises: 0048

Rezepte können jetzt Ausschlüsse tragen („enthält Schweinefleisch/…") — dafür
die M2M-Tabelle `recipe_exclusions`, analog zu `recipe_allergens`.

Zusätzlich fliegt „Alkohol" aus der Ausschluss-Taxonomie (Produktentscheidung):
Die Zeile wird gelöscht, die zugehörigen `user_exclusions`-Einträge verschwinden
per bestehendem ondelete=CASCADE. Der 0046-Seed bleibt unangetastet — bei einer
Frischinstallation seedet 0046 „Alkohol", 0049 löscht es direkt wieder weg. Netto
ist es weg, ohne die alte Migration zu editieren.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0049"
down_revision: Union[str, None] = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipe_exclusions",
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("exclusion_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exclusion_id"], ["exclusions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("recipe_id", "exclusion_id"),
    )

    # „Alkohol" raus. user_exclusions-Einträge folgen per CASCADE.
    op.execute(sa.text("DELETE FROM exclusions WHERE name = 'Alkohol'"))


def downgrade() -> None:
    # „Alkohol" idempotent zurückholen (nur, falls nicht schon vorhanden).
    op.execute(sa.text(
        "INSERT INTO exclusions (name) SELECT 'Alkohol' "
        "WHERE NOT EXISTS (SELECT 1 FROM exclusions WHERE name = 'Alkohol')"
    ))
    op.drop_table("recipe_exclusions")
