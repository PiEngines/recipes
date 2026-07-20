"""Tests für die Summierung der Einkaufsliste (app/shopping/aggregate.py).

Reine Funktionen, keine DB. Die Regel ist bewusst konservativ: zusammengefasst
wird nur bei identischem normalisiertem Namen UND identischer Einheit UND wenn
sich alle Beträge als Bruch lesen lassen.
"""
from fractions import Fraction

import pytest

from app.shopping.aggregate import (
    aggregate_items,
    format_fraction,
    normalize_name,
    normalize_unit,
)
from app.utils.scaling import _to_readable_string


def item(id, name, amount, unit, checked=False, recipe_title=None, recipe_id=None, sort_order=0):
    return {
        "id": id, "name": name, "amount": amount, "unit": unit, "checked": checked,
        "recipe_title": recipe_title, "recipe_id": recipe_id, "sort_order": sort_order,
    }


# ── Normalisierung / Formatierung ────────────────────────────────────────────

@pytest.mark.parametrize("roh,erwartet", [
    ("  Tomaten ", "tomaten"),
    ("TOMATEN", "tomaten"),
    ("", ""),
    (None, ""),
])
def test_normalize_name(roh, erwartet):
    assert normalize_name(roh) == erwartet


def test_normalize_unit_ohne_einheit_ist_eigene_klasse():
    assert normalize_unit(None) == ""
    assert normalize_unit(" G ") == "g"


@pytest.mark.parametrize("n,d", [(3, 1), (1, 2), (9, 4), (7, 3), (0, 1), (12, 5)])
def test_format_fraction_entspricht_scaling_format(n, d):
    """Summierte und skalierte Mengen müssen gleich aussehen."""
    assert format_fraction(Fraction(n, d)) == _to_readable_string(Fraction(n, d))


# ── Zusammenfassen ───────────────────────────────────────────────────────────

def test_gleiche_einheit_wird_summiert():
    rows = aggregate_items([
        item(1, "Tomaten", "500", "g", recipe_title="A", recipe_id=1),
        item(2, "tomaten", "250", "g", recipe_title="B", recipe_id=2),
    ])
    assert len(rows) == 1
    assert rows[0]["amount"] == "750"
    assert rows[0]["merged_from_count"] == 2
    assert rows[0]["recipe_titles"] == ["A", "B"]
    assert rows[0]["source_ids"] == [1, 2]


def test_brueche_werden_summiert():
    rows = aggregate_items([
        item(1, "Mehl", "1/2", "kg"),
        item(2, "Mehl", "1/4", "kg"),
    ])
    assert rows[0]["amount"] == "3/4"


def test_unicode_bruch_wird_gelesen():
    rows = aggregate_items([
        item(1, "Zucker", "½", "TL"),
        item(2, "Zucker", "½", "TL"),
    ])
    assert len(rows) == 1
    assert rows[0]["amount"] == "1"


def test_einheiten_mismatch_bleibt_getrennt():
    rows = aggregate_items([
        item(1, "Tomaten", "500", "g"),
        item(2, "Tomaten", "2", "Stück"),
    ])
    assert len(rows) == 2
    assert all(r["merged_from_count"] == 1 for r in rows)


def test_unparsebarer_betrag_verhindert_fusion():
    """Lieber zwei ehrliche Zeilen als eine falsche Menge."""
    rows = aggregate_items([
        item(1, "Salz", "a pinch", None),
        item(2, "Salz", "2", None),
    ])
    assert len(rows) == 2
    assert {r["amount"] for r in rows} == {"a pinch", "2"}


def test_fehlender_betrag_verhindert_fusion():
    rows = aggregate_items([
        item(1, "Pfeffer", None, None),
        item(2, "Pfeffer", "1", None),
    ])
    assert len(rows) == 2


def test_erledigt_nur_wenn_alle_quellen_erledigt():
    teilweise = aggregate_items([
        item(1, "Mehl", "1/2", "kg", checked=True),
        item(2, "Mehl", "1/4", "kg", checked=False),
    ])
    assert teilweise[0]["checked"] is False

    komplett = aggregate_items([
        item(1, "Mehl", "1/2", "kg", checked=True),
        item(2, "Mehl", "1/4", "kg", checked=True),
    ])
    assert komplett[0]["checked"] is True


def test_reihenfolge_folgt_erstem_auftreten():
    """Die Liste darf beim Abhaken nicht springen."""
    rows = aggregate_items([
        item(1, "Zwiebel", "1", "Stück"),
        item(2, "Apfel", "2", "Stück"),
        item(3, "Zwiebel", "3", "Stück"),
    ])
    assert [r["name"] for r in rows] == ["Zwiebel", "Apfel"]
    assert rows[0]["amount"] == "4"


def test_recipe_titles_dedupliziert_und_ohne_none():
    rows = aggregate_items([
        item(1, "Öl", "1", "EL", recipe_title="A"),
        item(2, "Öl", "1", "EL", recipe_title="A"),
        item(3, "Öl", "1", "EL", recipe_title=None),
    ])
    assert rows[0]["recipe_titles"] == ["A"]
    assert rows[0]["merged_from_count"] == 3


def test_leere_liste():
    assert aggregate_items([]) == []
