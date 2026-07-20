"""Summierung der Einkaufsliste (Ansicht „Summiert").

Reine Funktionen ohne DB-Bezug — direkt testbar. Zusammengefasst wird bewusst
konservativ: nur bei identischem normalisiertem Namen UND identischer Einheit,
und nur wenn sich alle beteiligten Beträge als Bruch lesen lassen. Alles andere
bleibt getrennt stehen (keine Fuzzy-Namen, keine Einheiten-Umrechnung) —
lieber zwei ehrliche Zeilen als eine falsche Menge.
"""
from fractions import Fraction

from app.utils.amount_parser import parse_amount


def normalize_name(name: str) -> str:
    """Vergleichsform für die Zusammenfassung: klein, ohne Randleerzeichen."""
    return (name or "").strip().lower()


def normalize_unit(unit: str | None) -> str:
    """Einheiten-Vergleichsform. Ohne Einheit zählt als eigene Klasse."""
    return (unit or "").strip().lower()


def format_fraction(value: Fraction) -> str:
    """Bruch → lesbarer Mengen-String („3", „1/2", „2 1/4").

    Gleiches Ausgabeformat wie `app.utils.scaling` es beim Skalieren erzeugt,
    damit summierte und skalierte Mengen einheitlich aussehen.
    """
    if value.denominator == 1:
        return str(value.numerator)
    whole = int(value)
    remainder = value - whole
    if whole == 0:
        return f"{remainder.numerator}/{remainder.denominator}"
    return f"{whole} {remainder.numerator}/{remainder.denominator}"


def aggregate_items(items):
    """Positionen → summierte Zeilen.

    `items`: Objekte/Dicts mit id, name, amount, unit, checked, recipe_title,
    recipe_id, sort_order.

    Rückgabe: Liste von Dicts mit zusätzlich `merged_from_count`,
    `recipe_titles` und `source_ids`. Reihenfolge folgt dem ersten Auftreten,
    damit die Liste beim Abhaken nicht springt.
    """
    def get(item, key):
        return item[key] if isinstance(item, dict) else getattr(item, key, None)

    buckets: dict[tuple[str, str], list] = {}
    order: list[tuple[str, str]] = []
    for item in items:
        key = (normalize_name(get(item, "name")), normalize_unit(get(item, "unit")))
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(item)

    result = []
    for key in order:
        bucket = buckets[key]

        if len(bucket) == 1:
            result.append(_row(bucket[0], bucket, get))
            continue

        parsed = [parse_amount(get(i, "amount")) for i in bucket]
        if not all(isinstance(p, Fraction) for p in parsed):
            # Mindestens ein Betrag ist nicht lesbar („a pinch", leer) →
            # nicht zwangsfusionieren, jede Position bleibt für sich.
            for item in bucket:
                result.append(_row(item, [item], get))
            continue

        total = sum(parsed, Fraction(0))
        merged = _row(bucket[0], bucket, get)
        merged["amount"] = format_fraction(total)
        result.append(merged)

    return result


def _row(primary, sources, get):
    """Eine Ausgabezeile aus einer Quell-Position und ihren Quellen."""
    titles = []
    for s in sources:
        title = get(s, "recipe_title")
        if title and title not in titles:
            titles.append(title)
    return {
        "id": get(primary, "id"),
        "recipe_id": get(primary, "recipe_id"),
        "recipe_title": get(primary, "recipe_title"),
        "name": get(primary, "name"),
        "amount": get(primary, "amount"),
        "unit": get(primary, "unit"),
        # Eine zusammengefasste Zeile gilt nur als erledigt, wenn jede Quelle es ist.
        "checked": all(bool(get(s, "checked")) for s in sources),
        "sort_order": get(primary, "sort_order") or 0,
        "merged_from_count": len(sources),
        "recipe_titles": titles,
        # Alle beteiligten Positionen — die Ansicht braucht sie zum Abhaken.
        "source_ids": [get(s, "id") for s in sources],
    }
