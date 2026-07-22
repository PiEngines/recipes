"""Einheiten: kanonische Schreibweise und Umrechnung (BUG-34).

Eine Quelle für drei Verwender: die Normalisierung beim Speichern
(`recipes/schemas.py`), die einmalige Bereinigung des Bestands (Migration 0042)
und die Zusammenfassung der Einkaufsliste (`shopping/aggregate.py`).

Zwei Dinge, die bewusst *nicht* passieren:

* **Nichts wird weggeworfen.** Eine unbekannte Einheit („Handvoll", „Schuss")
  bleibt erhalten, nur getrimmt. Der Nutzer hat sie so eingegeben, und eine
  fremde Einheit ist keine falsche.
* **Nicht alles ist umrechenbar.** Löffel, Prisen und Stück hängen an Zutat und
  Küche — 1 EL Mehl und 1 EL Öl wiegen nicht dasselbe. Für diese Einheiten gibt
  es nur die einheitliche Schreibweise, keine Umrechnung.

Rein funktional, ohne DB-Bezug.
"""
from fractions import Fraction

# Kanonisches Label → Schreibweisen, die darauf abgebildet werden.
# Der Vergleich läuft über `_key()`: klein, ohne Punkte und Leerzeichen.
_SYNONYME: dict[str, tuple[str, ...]] = {
    "g": ("g", "gr", "gramm"),
    "kg": ("kg", "kilo", "kilogramm"),
    "ml": ("ml", "milliliter"),
    "l": ("l", "ltr", "liter"),
    "EL": ("el", "esslöffel", "essloeffel", "essl"),
    "TL": ("tl", "teelöffel", "teeloeffel", "teel"),
    "Prise": ("prise", "prisen"),
    "Msp.": ("msp", "messerspitze"),
    "Pkg.": ("pkg", "pck", "packung"),
    "St.": ("st", "stk", "stück", "stueck"),
}


def _key(unit: str) -> str:
    """Vergleichsform: klein, ohne Punkte, Leerzeichen und Randzeichen."""
    return unit.strip().lower().replace(".", "").replace(" ", "")


_NACH_KEY: dict[str, str] = {
    _key(schreibweise): label
    for label, schreibweisen in _SYNONYME.items()
    for schreibweise in schreibweisen
}

# Umrechenbare Einheiten: Label → (Faktor in Basis, Basis-Label).
_IN_BASIS: dict[str, tuple[int, str]] = {
    "g": (1, "g"),
    "kg": (1000, "g"),
    "ml": (1, "ml"),
    "l": (1000, "ml"),
}

# Ab dieser Menge wird die große Einheit gezeigt: 1500 g → „1,5 kg".
_GROSSE_EINHEIT: dict[str, tuple[int, str]] = {
    "g": (1000, "kg"),
    "ml": (1000, "l"),
}


def normalize_label(unit: str | None) -> str | None:
    """Kanonische Schreibweise einer Einheit.

    Unbekanntes kommt getrimmt zurück, `None` und Leerstring bleiben, was sie
    sind — eine Zutat ohne Einheit („2 Eier") ist ein gültiger Fall.
    """
    if unit is None:
        return None
    getrimmt = unit.strip()
    if not getrimmt:
        return getrimmt
    return _NACH_KEY.get(_key(getrimmt), getrimmt)


def is_convertible(unit: str | None) -> bool:
    """Lässt sich die Einheit in eine Basis-Einheit überführen?"""
    return normalize_label(unit) in _IN_BASIS


def base_unit(unit: str | None) -> str | None:
    """Basis-Einheit der Familie (`g` oder `ml`), sonst `None`."""
    eintrag = _IN_BASIS.get(normalize_label(unit) or "")
    return eintrag[1] if eintrag else None


def to_base(amount: Fraction, unit: str | None) -> tuple[Fraction, str] | None:
    """Menge in die Basis-Einheit ihrer Familie umrechnen.

    `None`, wenn die Einheit nicht umrechenbar ist (Löffel, Prise, Stück,
    Unbekanntes) — der Aufrufer behandelt sie dann als eigene Klasse.
    """
    eintrag = _IN_BASIS.get(normalize_label(unit) or "")
    if eintrag is None:
        return None
    faktor, basis = eintrag
    return amount * faktor, basis


def present(amount_in_base: Fraction, base: str) -> tuple[Fraction, str]:
    """Basis-Menge in die Einheit bringen, in der man sie hinschreibt.

    Ab 1000 wird hochskaliert (1500 g → 1,5 kg), darunter bleibt die Basis.
    Unterhalb der Schwelle zu skalieren ergäbe „0,5 kg" statt „500 g" — genau
    das, was man auf einem Einkaufszettel nicht lesen will.
    """
    schwelle = _GROSSE_EINHEIT.get(base)
    if schwelle:
        faktor, gross = schwelle
        if amount_in_base >= faktor:
            return amount_in_base / faktor, gross
    return amount_in_base, base
