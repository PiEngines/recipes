"""Zutaten-Extraktion aus einer Beitrags-Caption (F3b-1 · Commit 2).

Bewusst eine Heuristik, **kein LLM**: Captions sind formal nicht garantiert,
und das Ergebnis ist im Frontend ohnehin editierbar. Ziel ist „meistens grob
richtig, nie kaputt" — lieber eine Zeile zu viel in der Liste, die der User
löscht, als eine fehlende Zutat, die er nicht bemerkt.

Vorgehen je Caption-Zeile:
  1. Rauschen entfernen (Aufzählungszeichen, Hashtags, Emoji-Kästchen).
  2. Zeilen verwerfen, die erkennbar keine Zutat sind (Überschriften, Links,
     Fliesstext).
  3. Menge, Einheit und Name abtrennen.

`app.utils.amount_parser.parse_amount` dient dabei als Prüfstein: liefert es
eine `Fraction`, war der Mengenteil wirklich eine Zahl.
"""
import re
from fractions import Fraction

from app.utils.amount_parser import _UNICODE_FRACTIONS, parse_amount

# Zeilen ab dieser Länge sind Fliesstext, keine Zutat.
_MAX_ZEILENLAENGE = 80

# Aufzählungszeichen und Checkbox-Glyphen am Zeilenanfang.
_BULLET = re.compile(r"^[\s\-–—•*·▢□☐●▪→>]+")

_HASHTAG = re.compile(r"#\w+")
_URL = re.compile(r"https?://|www\.", re.IGNORECASE)

_ZAHL = r"\d+(?:[.,]\d+)?"
_BRUCH = "".join(re.escape(z) for z in _UNICODE_FRACTIONS)

# Reihenfolge ist entscheidend: die längeren Formen müssen zuerst greifen,
# sonst schluckt `\d+` bei „1 1/2" nur die führende 1.
_MENGE = re.compile(
    r"^(?P<amount>"
    rf"{_ZAHL}\s*(?:[-–]|\s+bis\s+)\s*{_ZAHL}"   # 2-3, 2 bis 3
    rf"|{_ZAHL}\s+{_ZAHL}\s*/\s*{_ZAHL}"          # 1 1/2
    rf"|{_ZAHL}\s*/\s*{_ZAHL}"                    # 1/2
    rf"|{_ZAHL}\s*[{_BRUCH}]"                     # 1½
    rf"|[{_BRUCH}]"                               # ½
    rf"|{_ZAHL}"                                  # 2
    r")\s*",
)

# Gängige Einheiten. Vergleich case-insensitiv, ausgegeben wird die Schreibweise
# aus der Caption — „EL" soll „EL" bleiben und nicht zu „el" werden.
_EINHEITEN = {
    "g", "gr", "gramm", "kg", "kilo", "kilogramm", "mg",
    "ml", "cl", "dl", "l", "liter", "milliliter",
    "el", "tl", "essloeffel", "esslöffel", "teeloeffel", "teelöffel",
    "msp", "messerspitze", "prise", "prisen",
    "stueck", "stück", "stk", "st",
    "zehe", "zehen", "bund", "buendel", "bündel",
    "dose", "dosen", "glas", "glaeser", "gläser",
    "packung", "packungen", "paeckchen", "päckchen", "pck",
    "becher", "tasse", "tassen", "kugel", "kugeln",
    "scheibe", "scheiben", "blatt", "blätter", "blaetter",
    "handvoll", "spritzer", "tropfen", "schuss", "zweig", "zweige",
}


def _bereinigt(zeile: str) -> str:
    """Aufzählungszeichen und Hashtags weg, Whitespace normalisiert."""
    ohne_bullet = _BULLET.sub("", zeile)
    ohne_hashtags = _HASHTAG.sub("", ohne_bullet)
    return " ".join(ohne_hashtags.split())


def _ist_zutat(zeile: str) -> bool:
    """Grobfilter gegen Überschriften, Links und Fliesstext."""
    if not zeile or len(zeile) > _MAX_ZEILENLAENGE:
        return False
    if zeile.endswith(":"):          # „Zutaten:", „Für den Teig:"
        return False
    if _URL.search(zeile):
        return False
    return any(zeichen.isalpha() for zeichen in zeile)


def _menge_und_rest(zeile: str) -> tuple[str | None, str]:
    """Führende Menge abtrennen. Gibt (Menge oder None, Rest) zurück."""
    treffer = _MENGE.match(zeile)
    if treffer is None:
        return None, zeile

    roh = " ".join(treffer.group("amount").split())
    rest = zeile[treffer.end():].strip()

    # Ohne Rest war die Zahl der ganze Zeileninhalt — dann ist es keine Menge,
    # sondern (bestenfalls) der Name.
    if not rest:
        return None, zeile

    geparst = parse_amount(roh)
    if isinstance(geparst, Fraction) and geparst.denominator == 1:
        # Glatte Zahl vereinheitlichen: „2.0" und „2" sollen gleich aussehen.
        return str(geparst.numerator), rest
    return roh, rest


def _einheit_und_name(rest: str) -> tuple[str | None, str]:
    teile = rest.split(maxsplit=1)
    if not teile or teile[0].rstrip(".").lower() not in _EINHEITEN:
        return None, rest

    einheit = teile[0].rstrip(".")
    # „200 g" ohne Zutat: der Name bleibt leer, die Zeile fällt damit weg.
    return einheit, teile[1].strip() if len(teile) == 2 else ""


def extract_ingredients(caption_text: str | None) -> list[dict]:
    """Caption in eine Liste `[{amount, unit, name, raw}, …]` zerlegen.

    `raw` behält die bereinigte Originalzeile — damit bleibt im Frontend
    nachvollziehbar, woraus eine Position entstanden ist, auch wenn die
    Heuristik danebenlag.
    """
    if not caption_text:
        return []

    zutaten: list[dict] = []
    for zeile in caption_text.splitlines():
        sauber = _bereinigt(zeile)
        if not _ist_zutat(sauber):
            continue

        menge, rest = _menge_und_rest(sauber)
        einheit, name = _einheit_und_name(rest) if menge else (None, rest)
        if not name:
            continue

        zutaten.append({
            "amount": menge,
            "unit": einheit,
            "name": name,
            "raw": sauber,
        })

    return zutaten
