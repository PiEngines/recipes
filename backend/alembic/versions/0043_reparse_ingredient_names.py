"""reparse ingredients.name → name + unit (FR-N)

Revision ID: 0043
Revises: 0042

Reine Daten-Migration, keine Schema-Änderung. 0042 hat die Einheiten-Spalte
kanonisiert; hier kommt der Bestand dran, bei dem die Einheit gar nicht erst in
der Spalte gelandet ist: Der Wizard-Parser kennt eine kürzere Einheitenliste
als das Backend, „50gr mehl" wurde deshalb als `name="gr mehl", amount="50",
unit=NULL` gespeichert.

Anders als 0042 geht das **zeilenweise**: die Entscheidung hängt an Name *und*
Menge zusammen, ein UPDATE je distinct-Wert würde die Menge nicht sehen.
Angefasst werden nur Zeilen, bei denen sich wirklich etwas ändert.

Die Regel kommt aus `app.utils.ingredients`, damit Speicherpfad und Bestand
dieselbe Quelle nutzen. Das koppelt die Migration an App-Code — auf einer
frischen DB gilt dann das *dann* aktuelle Kanon. Für eine Vereinheitlichung ist
genau das erwünscht, es soll ja nicht die Regel von gestern gelten.

Der Fehltreffer-Guard steckt im Normalizer: ohne Menge wird nichts aus dem
Namen gelöst, „El Paso Sauce" bleibt also eine Sauce.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.ingredients import normalize_ingredient

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels = None
depends_on = None


def reparse(conn) -> list[tuple[str, str, str | None]]:
    """Zutatennamen neu zerlegen: Einheit heraus, Name geputzt.

    Als eigene Funktion mit übergebener Connection, damit sie auch ohne
    Alembic-Kontext testbar ist — wie `vereinheitlichen` in 0042.

    Rückgabe: `(alter_name, neuer_name, neue_einheit)` je geänderter Zeile,
    für die Stichprobe im Deploy-Log.
    """
    zeilen = conn.execute(sa.text(
        "SELECT id, name, amount, unit FROM ingredients"
    )).fetchall()

    geaendert: list[tuple[str, str, str | None]] = []
    for zeile_id, name, amount, unit in zeilen:
        neuer_name, neue_einheit = normalize_ingredient(name, amount, unit)
        # Ein leerer Name wäre schlimmer als ein unsauberer — dann lieber die
        # Zeile lassen, wie sie ist.
        if not neuer_name:
            continue
        if neuer_name == name and neue_einheit == unit:
            continue
        conn.execute(
            sa.text("UPDATE ingredients SET name = :name, unit = :unit WHERE id = :id"),
            {"name": neuer_name, "unit": neue_einheit, "id": zeile_id},
        )
        geaendert.append((name, neuer_name, neue_einheit))
    return geaendert


def upgrade() -> None:
    reparse(op.get_bind())


def downgrade() -> None:
    """Bewusst leer.

    Nach dem Upgrade steht die Einheit in ihrer eigenen Spalte und der Name
    ohne sie da. Welche Zeile ursprünglich „gr mehl" und welche „mehl" hieß,
    ist nicht mehr rekonstruierbar — ein Downgrade könnte nur raten. Dann
    lieber nichts tun, als etwas Falsches zurückzuschreiben. Die Spalten selbst
    sind unverändert, ein Rückschritt auf 0042 bleibt strukturell gefahrlos.
    """
