"""Summierung der Einkaufsliste (Ansicht „Summiert").

Reine Funktionen ohne DB-Bezug — direkt testbar. Zusammengefasst wird bei
identischem normalisiertem Namen und verträglicher Einheit, und nur wenn sich
alle beteiligten Beträge als Bruch lesen lassen. Alles andere bleibt getrennt
stehen (keine Fuzzy-Namen) — lieber zwei ehrliche Zeilen als eine falsche Menge.

„Verträglich" heißt seit BUG-34 mehr als „identisch": Gewichte und Volumina
werden über `app.utils.units` in ihre Basis-Einheit gerechnet, „500 g" und
„1 kg" derselben Zutat landen also in einem Topf. Löffel, Prisen und Stück
lassen sich nicht sinnvoll ineinander umrechnen — die bleiben nach kanonischem
Label getrennt, wie bisher.
"""
from fractions import Fraction

from app.utils.amount_parser import parse_amount
from app.utils.units import base_unit, normalize_label, present, to_base


def normalize_name(name: str) -> str:
    """Vergleichsform für die Zusammenfassung: klein, ohne Randleerzeichen."""
    return (name or "").strip().lower()


def normalize_unit(unit: str | None) -> str:
    """Einheiten-Vergleichsform: kanonisches Label, ohne Einheit als eigene Klasse.

    Seit BUG-34 über `units.normalize_label` statt nur `lower()` — damit fallen
    „g" und „Gramm" schon vor jeder Umrechnung zusammen, auch bei Positionen,
    die vor der Migration angelegt wurden.
    """
    return normalize_label(unit) or ""


def _bucket_key(name: str, unit: str | None) -> tuple:
    """Gruppierungsschlüssel einer Position.

    Umrechenbare Einheiten teilen sich den Schlüssel ihrer Basis-Familie, alles
    andere den des kanonischen Labels. Die beiden Namensräume sind bewusst
    getrennt, damit eine Zutat mit Basis `g` nicht auf eine mit dem Label „g"
    trifft — dasselbe Ergebnis, aber ohne stillschweigende Kollision.
    """
    basis = base_unit(unit)
    if basis:
        return (normalize_name(name), ("basis", basis))
    return (normalize_name(name), ("label", normalize_unit(unit)))


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

    buckets: dict[tuple, list] = {}
    order: list[tuple] = []
    for item in items:
        key = _bucket_key(get(item, "name"), get(item, "unit"))
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(item)

    result = []
    for key in order:
        bucket = buckets[key]

        # Eine einzelne Position wird nicht angefasst — sie steht so da, wie sie
        # eingetragen wurde. Umgerechnet wird nur, wo wirklich summiert wird.
        if len(bucket) == 1:
            result.append(_row(bucket[0], bucket, get))
            continue

        art, einheit_der_familie = key[1]
        summiert = (
            _summe_umgerechnet(bucket, einheit_der_familie, get)
            if art == "basis"
            else _summe_gleiche_einheit(bucket, get)
        )

        if summiert is None:
            # Mindestens ein Betrag ist nicht lesbar („a pinch", leer) →
            # nicht zwangsfusionieren, jede Position bleibt für sich.
            for item in bucket:
                result.append(_row(item, [item], get))
            continue

        menge, einheit = summiert
        merged = _row(bucket[0], bucket, get)
        merged["amount"] = format_fraction(menge)
        if einheit is not None:
            merged["unit"] = einheit
        result.append(merged)

    return result


def _summe_gleiche_einheit(bucket, get) -> tuple[Fraction, None] | None:
    """Positionen mit identischer Einheit aufaddieren — Einheit bleibt."""
    parsed = [parse_amount(get(i, "amount")) for i in bucket]
    if not all(isinstance(p, Fraction) for p in parsed):
        return None
    return sum(parsed, Fraction(0)), None


def _summe_umgerechnet(bucket, basis: str, get) -> tuple[Fraction, str | None] | None:
    """Gewichte bzw. Volumina addieren.

    Tragen alle Positionen dieselbe Einheit, wird in dieser Einheit summiert und
    sie bleibt stehen — „1/2 kg + 1/4 kg" ergibt „3/4 kg", nicht „750 g". Erst
    wenn die Einheiten auseinandergehen, muss eine gewählt werden: dann geht es
    über die Basis und `present` entscheidet.
    """
    labels = {normalize_unit(get(i, "unit")) for i in bucket}
    if len(labels) == 1:
        summe = _summe_gleiche_einheit(bucket, get)
        return (summe[0], labels.pop()) if summe else None

    gesamt = Fraction(0)
    for i in bucket:
        menge = parse_amount(get(i, "amount"))
        if not isinstance(menge, Fraction):
            return None
        umgerechnet = to_base(menge, get(i, "unit"))
        if umgerechnet is None:
            # Sollte nicht vorkommen — der Schlüssel entsteht aus derselben
            # Prüfung. Defensiv, damit eine Änderung dort hier nicht still
            # eine falsche Summe erzeugt.
            return None
        gesamt += umgerechnet[0]
    return present(gesamt, basis)


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
