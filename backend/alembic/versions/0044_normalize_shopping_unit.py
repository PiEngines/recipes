"""normalize shopping_list_items.unit (BUG-34, Nachzug)

Revision ID: 0044
Revises: 0043

Reine Daten-Migration, keine Schema-Änderung — der Nachzug zu 0042, die
dasselbe für `ingredients.unit` getan hat. Übersehen wurde damals, dass die
Einkaufsliste ihre Einheiten als eigene Snapshots führt: eine manuell
angelegte Position („Gramm") stand unverändert neben den bereits
kanonisierten Rezept-Einheiten, sichtbar in der Ansicht „Nach Rezept", die
`item.unit` roh ausgibt.

Wie 0042 wird über die *distinct* Schreibweisen gearbeitet, nicht Zeile für
Zeile — ein UPDATE je Variante statt eines je Position. Die Entscheidung hängt
allein an der Einheit, mehr Kontext braucht es hier nicht (anders als bei 0043,
wo Name und Menge zusammen zählten).

Die Abbildung kommt aus `app.utils.units`, damit Migration, Speicherpfad und
Einkaufslisten-Summe dieselbe Quelle nutzen. Das koppelt die Migration an
App-Code: ändert sich die Tabelle später, normalisiert ein Lauf auf einer
frischen DB nach der *dann* geltenden Regel. Für eine Vereinheitlichung ist
genau das erwünscht — es soll das aktuelle Kanon gelten, nicht das von gestern.

Unbekannte Einheiten („Handvoll", „Schuss") bleiben erhalten, nur getrimmt;
`NULL` und Leerstring bleiben unangetastet. Der Lauf ist idempotent, weil
`normalize_label` auf einer kanonischen Form die Identität ist.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.units import normalize_label

revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels = None
depends_on = None


def vereinheitlichen(conn) -> dict[str, str]:
    """Einheiten in `shopping_list_items` kanonisieren.

    Als eigene Funktion mit übergebener Connection, damit sie auch ohne
    Alembic-Kontext testbar ist — wie `vereinheitlichen` in 0042 und `reparse`
    in 0043.

    Rückgabe: was worauf abgebildet wurde — nur die tatsächlichen Änderungen.
    """
    varianten = conn.execute(sa.text(
        "SELECT DISTINCT unit FROM shopping_list_items "
        "WHERE unit IS NOT NULL AND unit <> ''"
    )).fetchall()

    geaendert: dict[str, str] = {}
    for (roh,) in varianten:
        kanonisch = normalize_label(roh)
        if kanonisch and kanonisch != roh:
            conn.execute(
                sa.text("UPDATE shopping_list_items SET unit = :neu WHERE unit = :alt"),
                {"neu": kanonisch, "alt": roh},
            )
            geaendert[roh] = kanonisch
    return geaendert


def upgrade() -> None:
    vereinheitlichen(op.get_bind())


def downgrade() -> None:
    """Bewusst leer — dieselbe Begründung wie bei 0042.

    Nach dem Upgrade steht in der Spalte nur noch die kanonische Form; welche
    Position ursprünglich „Gramm" und welche „gr" hieß, ist nicht mehr
    rekonstruierbar. Ein Downgrade könnte also nur raten — dann lieber nichts
    tun, als etwas Falsches zurückzuschreiben. Die Spalte selbst ist
    unverändert, ein Rückschritt auf 0043 bleibt strukturell gefahrlos.
    """
