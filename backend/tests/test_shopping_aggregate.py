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


# ── Einheiten-bewusste Summierung (BUG-34) ───────────────────────────────────

def test_gramm_und_kilo_werden_zusammengefasst():
    rows = aggregate_items([
        item(1, "Mehl", "500", "g"),
        item(2, "Mehl", "500", "g"),
        item(3, "Mehl", "1", "kg"),
    ])
    assert len(rows) == 1
    assert rows[0]["amount"] == "2"
    assert rows[0]["unit"] == "kg"
    assert rows[0]["merged_from_count"] == 3


def test_unter_tausend_bleibt_die_basis_einheit():
    rows = aggregate_items([
        item(1, "Zucker", "200", "g"),
        item(2, "Zucker", "300", "g"),
    ])
    assert (rows[0]["amount"], rows[0]["unit"]) == ("500", "g")


def test_milliliter_und_liter():
    rows = aggregate_items([
        item(1, "Milch", "500", "ml"),
        item(2, "Milch", "1", "l"),
    ])
    assert (rows[0]["amount"], rows[0]["unit"]) == ("1 1/2", "l")


def test_schreibweisen_fallen_schon_ohne_umrechnung_zusammen():
    """„g" und „Gramm" sind dieselbe Einheit — auch bei Altbestand."""
    rows = aggregate_items([
        item(1, "Butter", "100", "g"),
        item(2, "Butter", "150", "Gramm"),
    ])
    assert len(rows) == 1
    assert (rows[0]["amount"], rows[0]["unit"]) == ("250", "g")


def test_prisen_werden_nicht_umgerechnet():
    rows = aggregate_items([
        item(1, "Salz", "1", "Prise"),
        item(2, "Salz", "1", "prisen"),
    ])
    assert len(rows) == 1
    assert (rows[0]["amount"], rows[0]["unit"]) == ("2", "Prise")


def test_el_und_tl_bleiben_getrennte_zeilen():
    rows = aggregate_items([
        item(1, "Öl", "2", "EL"),
        item(2, "Öl", "1", "TL"),
    ])
    assert len(rows) == 2
    assert {r["unit"] for r in rows} == {"EL", "TL"}


def test_gewicht_und_volumen_derselben_zutat_bleiben_getrennt():
    rows = aggregate_items([
        item(1, "Sahne", "200", "g"),
        item(2, "Sahne", "200", "ml"),
    ])
    assert len(rows) == 2


def test_einzelne_position_wird_nicht_umgerechnet():
    """Was einmal dasteht, bleibt so — umgerechnet wird nur beim Summieren."""
    rows = aggregate_items([item(1, "Mehl", "1500", "g")])
    assert (rows[0]["amount"], rows[0]["unit"]) == ("1500", "g")


def test_unlesbarer_betrag_verhindert_die_umrechnung():
    rows = aggregate_items([
        item(1, "Mehl", "500", "g"),
        item(2, "Mehl", "etwas", "kg"),
    ])
    assert len(rows) == 2
    assert rows[0]["merged_from_count"] == 1


def test_gleiche_einheit_bleibt_stehen():
    """Nur wenn die Einheiten auseinandergehen, wird eine gewählt."""
    rows = aggregate_items([
        item(1, "Mehl", "1/2", "kg"),
        item(2, "Mehl", "1/4", "kg"),
    ])
    assert (rows[0]["amount"], rows[0]["unit"]) == ("3/4", "kg")
