"""normalize ingredients.unit (BUG-34)

Revision ID: 0042
Revises: 0041

Reine Daten-Migration, keine Schema-Änderung: die vorhandenen
`ingredients.unit`-Werte werden einmalig auf die kanonische Schreibweise
gebracht („Gramm"/„gr" → „g", „Stück" → „St."). Ab dieser Revision hält der
Validator in `IngredientCreate` den Bestand kanonisch.

Gearbeitet wird über die *distinct* Schreibweisen, nicht Zeile für Zeile — ein
UPDATE je Variante statt eines je Zutat.

Die Abbildung kommt aus `app.utils.units`, damit Migration, Speicherpfad und
Einkaufslisten-Summe dieselbe Quelle nutzen. Das koppelt die Migration an
App-Code: ändert sich die Tabelle später, normalisiert ein Lauf auf einer
frischen DB nach der *dann* geltenden Regel. Für eine Vereinheitlichung ist
genau das erwünscht — es soll ja das aktuelle Kanon gelten, nicht das von
gestern.

Unbekannte Einheiten bleiben unangetastet.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.units import normalize_label

revision: str = "0042"
down_revision: Union[str, None] = "0041"
branch_labels = None
depends_on = None


def vereinheitlichen(conn) -> dict[str, str]:
    """Einheiten in `ingredients` kanonisieren.

    Als eigene Funktion mit übergebener Connection, damit sie auch ohne
    Alembic-Kontext testbar ist.

    Rückgabe: was worauf abgebildet wurde — nur die tatsächlichen Änderungen.
    """
    varianten = conn.execute(sa.text(
        "SELECT DISTINCT unit FROM ingredients "
        "WHERE unit IS NOT NULL AND unit <> ''"
    )).fetchall()

    geaendert: dict[str, str] = {}
    for (roh,) in varianten:
        kanonisch = normalize_label(roh)
        if kanonisch and kanonisch != roh:
            conn.execute(
                sa.text("UPDATE ingredients SET unit = :neu WHERE unit = :alt"),
                {"neu": kanonisch, "alt": roh},
            )
            geaendert[roh] = kanonisch
    return geaendert


def upgrade() -> None:
    vereinheitlichen(op.get_bind())


def downgrade() -> None:
    """Bewusst leer.

    Nach dem Upgrade steht in der Spalte nur noch die kanonische Form; welche
    Zeile ursprünglich „Gramm" und welche „gr" hieß, ist nicht mehr
    rekonstruierbar. Ein Downgrade könnte also nur raten — dann lieber nichts
    tun, als etwas Falsches zurückzuschreiben. Die Spalte selbst ist unverändert,
    ein Rückschritt auf 0041 bleibt strukturell also gefahrlos.
    """
