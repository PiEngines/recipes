"""Tests für die Einheiten-Normalisierung (BUG-34).

Reines Modul, keine DB — die Fälle stehen hier als Vertrag für die drei
Verwender (Speichern, Migration, Einkaufslisten-Summe).
"""
from fractions import Fraction

import pytest

from app.utils.units import (
    base_unit,
    is_convertible,
    normalize_label,
    present,
    to_base,
)


# ── Kanonische Schreibweise ──────────────────────────────────────────────────

@pytest.mark.parametrize("eingabe,erwartet", [
    ("g", "g"), ("gr", "g"), ("Gramm", "g"), ("GRAMM", "g"), ("  gramm  ", "g"),
    ("kg", "kg"), ("Kilo", "kg"), ("Kilogramm", "kg"),
    ("ml", "ml"), ("Milliliter", "ml"),
    ("l", "l"), ("ltr", "l"), ("Liter", "l"),
    ("EL", "EL"), ("el", "EL"), ("Esslöffel", "EL"), ("essl", "EL"),
    ("TL", "TL"), ("Teelöffel", "TL"), ("teel", "TL"),
    ("Prise", "Prise"), ("prisen", "Prise"),
    ("Msp", "Msp."), ("Msp.", "Msp."), ("Messerspitze", "Msp."),
    ("Pkg", "Pkg."), ("pck", "Pkg."), ("Packung", "Pkg."),
    ("St", "St."), ("stk", "St."), ("Stück", "St."), ("stueck", "St."),
])
def test_normalize_label_kennt_die_synonyme(eingabe, erwartet):
    assert normalize_label(eingabe) == erwartet


def test_punkte_und_leerzeichen_stoeren_nicht():
    assert normalize_label("St.") == "St."
    assert normalize_label(" k g ") == "kg"


def test_unbekanntes_bleibt_erhalten():
    """Eine fremde Einheit ist keine falsche — sie wird nur getrimmt."""
    assert normalize_label("Handvoll") == "Handvoll"
    assert normalize_label("  Schuss  ") == "Schuss"


def test_leer_und_none_bleiben():
    assert normalize_label(None) is None
    assert normalize_label("") == ""
    assert normalize_label("   ") == ""


# ── Umrechnung ──────────────────────────────────────────────────────────────

def test_umrechenbare_einheiten():
    assert is_convertible("Gramm") is True
    assert is_convertible("kg") is True
    assert is_convertible("Liter") is True
    assert base_unit("kg") == "g"
    assert base_unit("l") == "ml"


@pytest.mark.parametrize("unit", ["Prise", "St.", "EL", "TL", "Msp.", "Pkg.", "Handvoll", None, ""])
def test_nicht_umrechenbare_einheiten(unit):
    assert is_convertible(unit) is False
    assert base_unit(unit) is None
    assert to_base(Fraction(1), unit) is None


def test_to_base_rechnet_hoch():
    assert to_base(Fraction(1), "kg") == (Fraction(1000), "g")
    assert to_base(Fraction(500), "g") == (Fraction(500), "g")
    assert to_base(Fraction(2), "Liter") == (Fraction(2000), "ml")
    assert to_base(Fraction(1, 2), "kg") == (Fraction(500), "g")


def test_present_skaliert_erst_ab_tausend():
    assert present(Fraction(500), "g") == (Fraction(500), "g")
    assert present(Fraction(999), "g") == (Fraction(999), "g")
    assert present(Fraction(1000), "g") == (Fraction(1), "kg")
    assert present(Fraction(2500), "g") == (Fraction(5, 2), "kg")
    assert present(Fraction(1500), "ml") == (Fraction(3, 2), "l")


def test_present_laesst_fremde_basis_in_ruhe():
    assert present(Fraction(3), "EL") == (Fraction(3), "EL")
