"""Der Normalizer greift am Schema, nicht in den Routen (FR-N, Stufe 1).

Damit ist jeder Speicherweg abgedeckt, der durch diese Modelle geht: Rezept
anlegen, Rezept aktualisieren und der Einzel-Add aus der Schritt-Zuordnung.
Geprüft wird hier das Schema selbst — die Routen bringen keine eigene Logik
mehr mit, die abweichen könnte.
"""
from app.recipes.schemas import IngredientCreate, StepSuggestionAccept


def test_einheit_wandert_aus_dem_namen_in_das_feld():
    zutat = IngredientCreate(name="gr mehl", amount="50", unit=None)
    assert (zutat.name, zutat.amount, zutat.unit) == ("Mehl", "50", "g")


def test_zutat_ohne_einheit_bleibt_ohne():
    zutat = IngredientCreate(name="Eier", amount="1", unit=None)
    assert (zutat.name, zutat.unit) == ("Eier", None)


def test_gesetzte_einheit_wird_kanonisiert_und_der_name_geputzt():
    zutat = IngredientCreate(name="  brauner   senf", amount="1", unit="Esslöffel")
    assert (zutat.name, zutat.unit) == ("Brauner senf", "EL")


def test_ohne_menge_greift_der_fehltreffer_guard():
    zutat = IngredientCreate(name="El Paso Sauce", amount=None, unit=None)
    assert (zutat.name, zutat.unit) == ("El Paso Sauce", None)


def test_einzel_add_geht_denselben_weg():
    """`StepSuggestionAccept` legt direkt eine Ingredient-Zeile an."""
    vorschlag = StepSuggestionAccept(name="gr mehl", quantity="50", unit=None, step_ids=[1])
    assert (vorschlag.name, vorschlag.unit) == ("Mehl", "g")

    ohne_menge = StepSuggestionAccept(name="El Paso Sauce", quantity=None, unit=None, step_ids=[1])
    assert (ohne_menge.name, ohne_menge.unit) == ("El Paso Sauce", None)
