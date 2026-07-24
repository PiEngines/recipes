"""Persönlicher Ernährungs-Filter in list_recipes (Ü26 B2.1).

Rein negativ: blende aus, was explizit getaggt ist; ungetaggte Rezepte bleiben.
Die Diät-Wahl erweitert die Ausschluss-/Allergen-Menge. `personal_hidden` zählt
die ausgeblendeten Treffer — auch bei `personal_off=True`. Läuft gegen eine
echte SQLite-Session mit vollem Schema; der Test-User ist Autor aller Rezepte,
damit die Sichtbarkeit sie nicht zusätzlich filtert.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Allergen, DietLabel, Exclusion, Recipe
from app.models.user import UserRole
from app.recipes.router import router as recipes_router
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    user = make_user(db, 1, "koechin", UserRole.koch)

    diet = {n: DietLabel(name=n) for n in ("Vegetarisch", "Vegan")}
    allerg = {n: Allergen(name=n) for n in ("Fisch", "Eier", "Milch/Laktose")}
    excl = {n: Exclusion(name=n) for n in ("Rindfleisch",)}
    db.add_all([*diet.values(), *allerg.values(), *excl.values()])
    db.flush()

    # Vier Rezepte, alle vom User (→ sichtbar). Nur die getaggten sollen fallen.
    r_rind = Recipe(id=1, title="Rindergulasch", created_by=1, author_id=1)
    r_rind.exclusions = [excl["Rindfleisch"]]
    r_gemuese = Recipe(id=2, title="Gemuesesuppe", created_by=1, author_id=1)  # ungetaggt
    r_fisch = Recipe(id=3, title="Fischsuppe", created_by=1, author_id=1)
    r_fisch.allergens = [allerg["Fisch"]]
    r_ei = Recipe(id=4, title="Eierkuchen", created_by=1, author_id=1)
    r_ei.allergens = [allerg["Eier"]]
    db.add_all([r_rind, r_gemuese, r_fisch, r_ei])
    db.commit()

    app = FastAPI()
    app.include_router(recipes_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    yield TestClient(app), db, user, diet
    db.close()


def _titles(data):
    return {i["title"] for i in data["items"]}


def test_leeres_profil_kein_filter(ctx):
    c, _, _, _ = ctx
    data = c.get("/api/recipes").json()
    assert _titles(data) == {"Rindergulasch", "Gemuesesuppe", "Fischsuppe", "Eierkuchen"}
    assert data["personal_hidden"] == 0
    assert data["total"] == 4


def test_vegetarisch_blendet_fleisch_und_fisch_aus(ctx):
    c, db, user, diet = ctx
    user.diet_labels = [diet["Vegetarisch"]]
    db.commit()

    data = c.get("/api/recipes").json()
    # Rindfleisch (Ausschluss) + Fisch (Allergen) raus; Ungetaggtes + Eier bleiben.
    assert _titles(data) == {"Gemuesesuppe", "Eierkuchen"}
    assert data["personal_hidden"] == 2
    assert data["total"] == 2


def test_personal_off_zeigt_alles_zaehler_bleibt(ctx):
    c, db, user, diet = ctx
    user.diet_labels = [diet["Vegetarisch"]]
    db.commit()

    data = c.get("/api/recipes", params={"personal_off": True}).json()
    assert _titles(data) == {"Rindergulasch", "Gemuesesuppe", "Fischsuppe", "Eierkuchen"}
    assert data["total"] == 4
    # Zähler kennt weiterhin die ausgeblendete Menge (für den Toggle-Text).
    assert data["personal_hidden"] == 2


def test_vegan_blendet_zusaetzlich_eier_aus(ctx):
    c, db, user, diet = ctx
    user.diet_labels = [diet["Vegan"]]
    db.commit()

    data = c.get("/api/recipes").json()
    assert _titles(data) == {"Gemuesesuppe"}
    assert data["personal_hidden"] == 3


def test_profil_allergen_direkt_ohne_diaet(ctx):
    c, db, user, _ = ctx
    # Nur ein Profil-Allergen (Fisch), keine Diät.
    user.allergens = [db.query(Allergen).filter_by(name="Fisch").first()]
    db.commit()

    data = c.get("/api/recipes").json()
    assert "Fischsuppe" not in _titles(data)
    assert data["personal_hidden"] == 1
