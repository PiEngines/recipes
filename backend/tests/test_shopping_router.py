"""Tests für die Einkaufslisten-Endpoints (/api/shopping-list).

Übt die Endpoints gegen eine echte SQLite-Session aus — nicht gegen die
gemockte Session aus conftest.py.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Ingredient, Recipe, ShoppingListItem
from app.models.user import UserRole
from app.shopping.router import router as shopping_router
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    """App + Session mit einem Rezept (4 Portionen) und zwei Usern."""
    Session = make_session_factory()
    db = Session()
    besitzer = make_user(db, 1, "besitzer", UserRole.koch)
    make_user(db, 2, "fremder", UserRole.koch)
    db.add(Recipe(id=1, title="Tomatensugo", servings=4, created_by=1, author_id=1))
    db.commit()
    for iid, name, amount, unit, so in [
        (10, "Tomaten", "500", "g", 0),
        (11, "Zwiebel", "2", "Stück", 1),
        (12, "Olivenöl", "3", "EL", 2),
        (13, "Salz", None, None, 3),
    ]:
        db.add(Ingredient(id=iid, recipe_id=1, name=name, amount=amount, unit=unit, sort_order=so))
    db.commit()

    app = FastAPI()
    app.include_router(shopping_router)
    app.dependency_overrides[get_db] = lambda: Session()
    app.dependency_overrides[get_current_user] = lambda: besitzer

    yield TestClient(app), db, besitzer
    db.close()


# ── manuelle Positionen ──────────────────────────────────────────────────────

def test_leere_liste_und_fortschritt(ctx):
    c, _, _ = ctx
    body = c.get("/api/shopping-list").json()
    assert body["groups"] == []
    assert body["progress"] == {"total": 0, "done": 0, "percent": 0}


def test_manuelle_position_201_und_getrimmt(ctx):
    c, _, _ = ctx
    r = c.post("/api/shopping-list/items", json={"name": "  Klopapier  ", "amount": "1", "unit": "Pack"})
    assert r.status_code == 201
    assert r.json()["name"] == "Klopapier"
    assert r.json()["recipe_id"] is None


def test_leerer_name_422(ctx):
    c, _, _ = ctx
    assert c.post("/api/shopping-list/items", json={"name": ""}).status_code == 422


# ── aus Rezept übernehmen ────────────────────────────────────────────────────

def test_from_recipe_skaliert_auf_portionen(ctx):
    """Basis 4 Portionen, angefordert 8 → Mengen verdoppelt."""
    c, db, _ = ctx
    r = c.post("/api/shopping-list/from-recipe",
               json={"recipe_id": 1, "servings": 8, "ingredient_ids": [10, 11, 13]})
    assert r.status_code == 201
    assert r.json()["added"] == 3

    items = {i.name: i for i in db.query(ShoppingListItem).all()}
    assert items["Tomaten"].amount == "1000"
    assert items["Zwiebel"].amount == "4"
    assert items["Salz"].amount is None          # ohne Menge bleibt ohne Menge
    assert "Olivenöl" not in items               # nicht gewählte Zutat fehlt
    assert items["Tomaten"].recipe_title == "Tomatensugo"
    assert items["Tomaten"].unit == "g"


def test_from_recipe_halbiert(ctx):
    c, db, _ = ctx
    c.post("/api/shopping-list/from-recipe",
           json={"recipe_id": 1, "servings": 2, "ingredient_ids": [10]})
    assert db.query(ShoppingListItem).first().amount == "250"


def test_from_recipe_fremde_ingredient_id_422(ctx):
    c, _, _ = ctx
    r = c.post("/api/shopping-list/from-recipe",
               json={"recipe_id": 1, "servings": 4, "ingredient_ids": [10, 999]})
    assert r.status_code == 422


def test_from_recipe_unbekanntes_rezept_404(ctx):
    c, _, _ = ctx
    r = c.post("/api/shopping-list/from-recipe",
               json={"recipe_id": 999, "servings": 4, "ingredient_ids": [10]})
    assert r.status_code == 404


def test_from_recipe_servings_null_422(ctx):
    c, _, _ = ctx
    r = c.post("/api/shopping-list/from-recipe",
               json={"recipe_id": 1, "servings": 0, "ingredient_ids": [10]})
    assert r.status_code == 422


# ── Ansichten ────────────────────────────────────────────────────────────────

def test_gruppierung_nach_rezept_manuell_zuletzt(ctx):
    c, _, _ = ctx
    c.post("/api/shopping-list/from-recipe",
           json={"recipe_id": 1, "servings": 4, "ingredient_ids": [10, 11]})
    c.post("/api/shopping-list/items", json={"name": "Spülmittel"})

    body = c.get("/api/shopping-list?group=recipe").json()
    assert [g["recipe_title"] for g in body["groups"]] == ["Tomatensugo", "Ohne Rezept · manuell"]
    assert body["groups"][0]["position_count"] == 2
    assert body["items"] == []


def test_summierte_ansicht_fasst_gleiche_ware_zusammen(ctx):
    c, _, _ = ctx
    c.post("/api/shopping-list/from-recipe",
           json={"recipe_id": 1, "servings": 4, "ingredient_ids": [10]})
    c.post("/api/shopping-list/items", json={"name": "Tomaten", "amount": "200", "unit": "g"})

    body = c.get("/api/shopping-list?group=sum").json()
    zeile = [i for i in body["items"] if i["name"].lower() == "tomaten"]
    assert len(zeile) == 1
    assert zeile[0]["amount"] == "700"
    assert zeile[0]["merged_from_count"] == 2
    assert len(zeile[0]["source_ids"]) == 2      # nötig zum Abhaken
    assert body["groups"] == []


# ── Fortschritt / Toggle ─────────────────────────────────────────────────────

def test_fortschritt_zaehlt_einzelpositionen(ctx):
    c, db, _ = ctx
    c.post("/api/shopping-list/from-recipe",
           json={"recipe_id": 1, "servings": 4, "ingredient_ids": [10, 11, 12, 13]})
    erste = db.query(ShoppingListItem).order_by(ShoppingListItem.id).first()

    assert c.get("/api/shopping-list").json()["progress"] == {"total": 4, "done": 0, "percent": 0}
    c.patch(f"/api/shopping-list/items/{erste.id}", json={"checked": True})
    assert c.get("/api/shopping-list").json()["progress"] == {"total": 4, "done": 1, "percent": 25}


def test_fortschritt_bleibt_positionsbasiert_in_summierter_ansicht(ctx):
    c, _, _ = ctx
    c.post("/api/shopping-list/items", json={"name": "Tomaten", "amount": "1", "unit": "g"})
    c.post("/api/shopping-list/items", json={"name": "Tomaten", "amount": "2", "unit": "g"})
    body = c.get("/api/shopping-list?group=sum").json()
    assert len(body["items"]) == 1                # eine Zeile …
    assert body["progress"]["total"] == 2         # … aber zwei Positionen


def test_patch_aendert_name_und_menge_ohne_checked_zu_verlieren(ctx):
    c, db, _ = ctx
    c.post("/api/shopping-list/items", json={"name": "Tomaten", "amount": "1"})
    item_id = db.query(ShoppingListItem).first().id
    c.patch(f"/api/shopping-list/items/{item_id}", json={"checked": True})
    r = c.patch(f"/api/shopping-list/items/{item_id}", json={"name": "Dosentomaten", "amount": "800"})
    assert r.json()["name"] == "Dosentomaten"
    assert r.json()["amount"] == "800"
    assert r.json()["checked"] is True


# ── Owner-Scoping ────────────────────────────────────────────────────────────

def test_fremde_position_ist_unsichtbar_und_nicht_aenderbar(ctx):
    c, db, _ = ctx
    fremd = ShoppingListItem(user_id=2, name="Fremdes", checked=False, sort_order=0)
    db.add(fremd)
    db.commit()

    body = c.get("/api/shopping-list").json()
    assert all(i["name"] != "Fremdes" for g in body["groups"] for i in g["items"])
    assert c.patch(f"/api/shopping-list/items/{fremd.id}", json={"checked": True}).status_code == 404
    assert c.delete(f"/api/shopping-list/items/{fremd.id}").status_code == 404


def test_unbekannte_position_404(ctx):
    c, _, _ = ctx
    assert c.patch("/api/shopping-list/items/999999", json={"checked": True}).status_code == 404
    assert c.delete("/api/shopping-list/items/999999").status_code == 404


# ── Löschen / clear-done ─────────────────────────────────────────────────────

def test_delete_entfernt_position(ctx):
    c, db, _ = ctx
    c.post("/api/shopping-list/items", json={"name": "Weg damit"})
    item_id = db.query(ShoppingListItem).first().id
    assert c.delete(f"/api/shopping-list/items/{item_id}").status_code == 204
    assert c.get("/api/shopping-list").json()["progress"]["total"] == 0


def test_clear_done_entfernt_nur_erledigte_und_nur_eigene(ctx):
    c, db, _ = ctx
    c.post("/api/shopping-list/items", json={"name": "Erledigt"})
    c.post("/api/shopping-list/items", json={"name": "Offen"})
    erledigt = db.query(ShoppingListItem).filter(ShoppingListItem.name == "Erledigt").first()
    c.patch(f"/api/shopping-list/items/{erledigt.id}", json={"checked": True})

    db.add(ShoppingListItem(user_id=2, name="Fremd erledigt", checked=True, sort_order=0))
    db.commit()

    assert c.post("/api/shopping-list/clear-done").json()["removed"] == 1
    body = c.get("/api/shopping-list").json()
    assert body["progress"] == {"total": 1, "done": 0, "percent": 0}
    assert db.query(ShoppingListItem).filter(ShoppingListItem.user_id == 2).count() == 1
