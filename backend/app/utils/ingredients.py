"""Zutaten kanonisieren (FR-N, Stufe 1).

Das Backend ist ab hier die autoritative Stelle: was der Wizard als Freitext
zerlegt hat, wird beim Speichern noch einmal geradegezogen. Anlass war
„50gr mehl" — der Client-Parser kennt eine eigene, kürzere Einheitenliste und
legte das als `name="gr mehl", amount="50", unit=None` ab. Die vollständige
Synonymliste liegt in `units.py`; hier wird sie auf den Zutatennamen angewandt.

Zwei Dinge passieren:

* **Einheit aus dem Namen lösen** — aber nur unter Auflagen, siehe unten.
* **Namen putzen** — Mehrfach-Leerzeichen zusammenziehen, trimmen, ersten
  Buchstaben groß. Bewusst *kein* Title-Case: „brauner senf" soll „Brauner
  senf" werden, nicht „Brauner Senf" — bei „Mehl Type 550" oder „Öl (nativ)"
  wüsste eine Wort-für-Wort-Regel nicht, wo sie aufhören soll.

Singular/Plural („2 Eier" ↔ „Ei") bleibt bewusst außen vor — das ist ein
eigener FR, weil es Wörterbuchwissen braucht und nicht nur Regeln.

Rein funktional, ohne DB-Bezug: dieselbe Funktion bedient den Speicherpfad
(`recipes/schemas.py`) und die einmalige Bereinigung des Bestands
(Migration 0043).
"""
import re

from app.utils.units import is_known_unit, normalize_label

_MEHRFACH_LEER = re.compile(r"\s+")


def clean_name(name: str | None) -> str:
    """Zutatenname in Anzeigeform: getrimmt, ein Leerzeichen, groß beginnend."""
    if not name:
        return ""
    geputzt = _MEHRFACH_LEER.sub(" ", name).strip()
    if not geputzt:
        return ""
    return geputzt[0].upper() + geputzt[1:]


def normalize_ingredient(
    name: str | None,
    amount: str | None,
    unit: str | None,
) -> tuple[str, str | None]:
    """Kanonische Form einer Zutat: `(name, unit)`.

    Die Einheit wird nur dann aus dem Namen gelöst, wenn **alle** vier
    Bedingungen zutreffen:

    1. `unit` ist leer — eine vom Autor gesetzte Einheit wird nie überstimmt.
    2. `amount` ist gesetzt. Das ist der Fehltreffer-Guard: „El Paso Sauce"
       ohne Menge bleibt eine Sauce. Nur wo eine Zahl davorsteht, ist das
       erste Wort überhaupt ein Einheiten-Kandidat.
    3. Das erste Wort steht in der Synonymliste (`units.py`), Vergleich ohne
       Rücksicht auf Groß-/Kleinschreibung und Punkte („Gr." zählt).
    4. Danach bleibt noch ein Name übrig. „50 gr" ohne Zutat wäre sonst eine
       Zutat ohne Namen.

    Die Wortgrenze ergibt sich aus dem Split am Leerzeichen: „grober Senf"
    zerfällt in „grober"/„Senf", und „grober" steht in keiner Liste.
    """
    einheit = normalize_label(unit)
    rest = _MEHRFACH_LEER.sub(" ", name or "").strip()

    if not (einheit or "").strip() and (amount or "").strip():
        erstes, _, danach = rest.partition(" ")
        if danach.strip() and is_known_unit(erstes):
            einheit = normalize_label(erstes)
            rest = danach.strip()

    return clean_name(rest), einheit
