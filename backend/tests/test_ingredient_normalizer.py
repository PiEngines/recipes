"""Tests für die Zutaten-Normalisierung (FR-N, Stufe 1).

Reines Modul, keine DB — die Fälle hier sind der Vertrag für die beiden
Verwender: den Speicherpfad (`recipes/schemas.py`) und die Migration 0043.
"""
import pytest

from app.utils.ingredients import clean_name, normalize_ingredient


# ── Einheit aus dem Namen lösen ──────────────────────────────────────────────

@pytest.mark.parametrize("name, amount, erwartet_name, erwartete_einheit", [
    # Der Anlassfall: der Client-Parser kennt „gr" nicht.
    ("gr mehl", "50", "Mehl", "g"),
    ("gramm Mehl", "5", "Mehl", "g"),
    ("EL Honig", "2", "Honig", "EL"),
    ("esslöffel Öl", "3", "Öl", "EL"),
    ("teelöffel Salz", "1", "Salz", "TL"),
    ("ml Milch", "200", "Milch", "ml"),
    ("liter Wasser", "1", "Wasser", "l"),
    ("kilo Kartoffeln", "2", "Kartoffeln", "kg"),
    ("prise Muskat", "1", "Muskat", "Prise"),
    ("packung Hefe", "1", "Hefe", "Pkg."),
    ("stück Ei", "3", "Ei", "St."),
    # Groß-/Kleinschreibung und Punkt sind egal.
    ("Gr. Zucker", "80", "Zucker", "g"),
    ("MSP Zimt", "1", "Zimt", "Msp."),
])
def test_einheit_wird_herausgeloest(name, amount, erwartet_name, erwartete_einheit):
    assert normalize_ingredient(name, amount, None) == (erwartet_name, erwartete_einheit)


def test_ohne_menge_bleibt_der_name_ganz():
    """Der Fehltreffer-Guard: ohne Menge ist „El" kein Esslöffel."""
    assert normalize_ingredient("El Paso Sauce", None, None) == ("El Paso Sauce", None)
    assert normalize_ingredient("El Paso Sauce", "", None) == ("El Paso Sauce", None)
    assert normalize_ingredient("gr mehl", None, None) == ("Gr mehl", None)


def test_gesetzte_einheit_wird_nicht_ueberstimmt():
    """Was der Autor gewählt hat, bleibt — geputzt wird nur der Name."""
    assert normalize_ingredient("gr mehl", "50", "TL") == ("Gr mehl", "TL")
    # Die gesetzte Einheit wird dabei selbst kanonisiert.
    assert normalize_ingredient("  brauner   senf ", "1", "Esslöffel") == ("Brauner senf", "EL")


def test_nur_eine_einheit_ohne_zutat_bleibt_stehen():
    """„50 gr" ohne Zutat würde sonst eine Zutat ohne Namen ergeben."""
    assert normalize_ingredient("gr", "50", None) == ("Gr", None)
    assert normalize_ingredient("EL", "2", None) == ("EL", None)


def test_unbekanntes_erstes_wort_bleibt_teil_des_namens():
    assert normalize_ingredient("grober Senf", "1", None) == ("Grober Senf", None)
    assert normalize_ingredient("Eier", "1", None) == ("Eier", None)
    assert normalize_ingredient("Handvoll Nüsse", "1", None) == ("Handvoll Nüsse", None)


# ── Name-Cleanup ─────────────────────────────────────────────────────────────

def test_name_wird_geputzt():
    assert normalize_ingredient("brauner  senf", "1", "EL") == ("Brauner senf", "EL")
    assert normalize_ingredient("  mehl  ", None, None) == ("Mehl", None)
    assert normalize_ingredient("mehl\ttype  550", None, None) == ("Mehl type 550", None)


def test_kein_title_case():
    """Nur der erste Buchstabe — der Rest bleibt, wie er getippt wurde."""
    assert clean_name("Mehl Type 550") == "Mehl Type 550"
    assert clean_name("öl (nativ extra)") == "Öl (nativ extra)"
    assert clean_name("brauner senf") == "Brauner senf"


def test_leeres_bleibt_leer():
    assert clean_name(None) == ""
    assert clean_name("   ") == ""
    assert normalize_ingredient("", None, None) == ("", None)


def test_leere_einheit_behaelt_ihre_form():
    """`None` und Leerstring sind nicht dasselbe — die DB-Spalte kennt beide."""
    assert normalize_ingredient("Mehl", "50", None)[1] is None
    assert normalize_ingredient("Mehl", "50", "")[1] == ""
