"""dietary profile: exclusions taxonomy, user M2M, visibility flags, seed (Ü18)

Revision ID: 0046
Revises: 0045

Erfasst das Ernährungsprofil des Nutzers — die Rezept-Seite bleibt unangetastet
(aktives Filtern ist ein Folge-FR). Neu:

* Taxonomie `exclusions` (analog zu `diet_labels`/`allergens`, die es schon gibt).
* Drei M2M-Tabellen `user_diet_labels` / `user_allergens` / `user_exclusions`.
* Sichtbarkeits-Flags am User: `diet_public`, `exclusions_public`. Allergien
  bekommen bewusst kein Flag — sie werden nie öffentlich gezeigt.
* Seed der Auswahlwerte (diet_labels, allergens = EU-14, exclusions),
  idempotent: je Tabelle nur, wenn sie leer ist. Wortlaut/Umfang darf Mike
  später anpassen.

Bestandsuser bekommen leere Profile; die Flags stehen per `server_default` auf
false, damit sie schon während des Backfills gesetzt sind.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0046"
down_revision: Union[str, None] = "0045"
branch_labels = None
depends_on = None


# Seed-Daten — bewusst hier statt in App-Code, damit die Migration allein
# reproduzierbar bleibt. Mike kann Wortlaut/Umfang später über die DB anpassen.
DIET_LABELS = ["Vegetarisch", "Vegan", "Pescetarisch", "Flexitarisch"]

ALLERGENS = [
    "Gluten", "Krebstiere", "Eier", "Fisch", "Erdnüsse", "Soja",
    "Milch/Laktose", "Schalenfrüchte/Nüsse", "Sellerie", "Senf", "Sesam",
    "Schwefeldioxid/Sulfite", "Lupinen", "Weichtiere",
]

EXCLUSIONS = ["Schweinefleisch", "Rindfleisch", "Geflügel", "Lamm", "Wild", "Alkohol"]


def _seed_if_empty(conn, table: str, names: list[str]) -> None:
    """Namen einfügen, aber nur, wenn die Tabelle leer ist — so bleibt ein
    zweiter Lauf (oder eine bereits von Hand gepflegte Tabelle) unangetastet."""
    vorhanden = conn.execute(sa.text(f"SELECT COUNT(*) FROM {table}")).scalar()
    if vorhanden:
        return
    conn.execute(
        sa.text(f"INSERT INTO {table} (name) VALUES (:name)"),
        [{"name": n} for n in names],
    )


def upgrade() -> None:
    op.create_table(
        "exclusions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    for tabelle, spalte, ziel in [
        ("user_diet_labels", "diet_label_id", "diet_labels"),
        ("user_allergens", "allergen_id", "allergens"),
        ("user_exclusions", "exclusion_id", "exclusions"),
    ]:
        op.create_table(
            tabelle,
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(spalte, sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint([spalte], [f"{ziel}.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", spalte),
        )

    op.add_column("users", sa.Column("diet_public", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("exclusions_public", sa.Boolean(), nullable=False, server_default=sa.false()))

    conn = op.get_bind()
    _seed_if_empty(conn, "diet_labels", DIET_LABELS)
    _seed_if_empty(conn, "allergens", ALLERGENS)
    _seed_if_empty(conn, "exclusions", EXCLUSIONS)


def downgrade() -> None:
    op.drop_column("users", "exclusions_public")
    op.drop_column("users", "diet_public")
    op.drop_table("user_exclusions")
    op.drop_table("user_allergens")
    op.drop_table("user_diet_labels")
    op.drop_table("exclusions")
