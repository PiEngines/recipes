"""Schreibpfad für Ernährungs-Tagging (Ü25 B1.2).

Anlegen/Aktualisieren eines Rezepts mit diet_label_ids/allergen_ids/
exclusion_ids persistiert die M2M-Relationen; die Detail-Response trägt alle
drei Listen (für die Edit-Hydration im Wizard). Läuft gegen eine echte
SQLite-Session mit vollem Schema.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user, require_koch_or_above
from app.database import get_db
from app.matching import step_scanner
from app.models import Allergen, DietLabel, Exclusion, Recipe
from app.models.user import UserRole
from app.recipes.router import router as recipes_router
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx(monkeypatch):
    # Der Step-Scanner läuft als BackgroundTask nach dem Create — im Test ohne
    # echten Worker/Storage stilllegen.
    monkeypatch.setattr(step_scanner, "trigger_step_scan", lambda *a, **k: None)

    Session = make_session_factory()
    db = Session()
    user = make_user(db, 1, "koechin", UserRole.koch)
    db.add_all([
        DietLabel(id=1, name="Vegan"), DietLabel(id=2, name="Vegetarisch"),
        Allergen(id=1, name="Gluten"), Allergen(id=2, name="Laktose"),
        Exclusion(id=1, name="Schweinefleisch"), Exclusion(id=2, name="Rindfleisch"),
    ])
    db.commit()

    app = FastAPI()
    app.include_router(recipes_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: user
    app.dependency_overrides[get_current_user] = lambda: user

    yield TestClient(app), db
    db.close()


def _create_body(**over):
    body = {
        "title": "Testrezept",
        "diet_label_ids": [1],
        "allergen_ids": [1, 2],
        "exclusion_ids": [1],
    }
    body.update(over)
    return body


def test_create_persistiert_tagging(ctx):
    c, db = ctx
    r = c.post("/api/recipes", json=_create_body())
    assert r.status_code == 201, r.text
    data = r.json()
    assert {d["name"] for d in data["diet_labels"]} == {"Vegan"}
    assert {a["name"] for a in data["allergens"]} == {"Gluten", "Laktose"}
    assert {e["name"] for e in data["exclusions"]} == {"Schweinefleisch"}

    rec = db.get(Recipe, data["id"])
    assert {e.name for e in rec.exclusions} == {"Schweinefleisch"}
    assert {d.name for d in rec.diet_labels} == {"Vegan"}


def test_update_aendert_tagging_selektiv(ctx):
    c, _ = ctx
    rid = c.post("/api/recipes", json=_create_body()).json()["id"]

    # Nur Ausschlüsse + Allergene mitgesendet; diet_label_ids weggelassen → bleibt.
    r = c.put(f"/api/recipes/{rid}", json={"exclusion_ids": [2], "allergen_ids": []})
    assert r.status_code == 200, r.text
    data = r.json()
    assert {e["name"] for e in data["exclusions"]} == {"Rindfleisch"}
    assert data["allergens"] == []
    assert {d["name"] for d in data["diet_labels"]} == {"Vegan"}


def test_detail_response_traegt_alle_drei_listen(ctx):
    c, _ = ctx
    rid = c.post("/api/recipes", json=_create_body()).json()["id"]
    data = c.get(f"/api/recipes/{rid}").json()
    assert {d["name"] for d in data["diet_labels"]} == {"Vegan"}
    assert {a["name"] for a in data["allergens"]} == {"Gluten", "Laktose"}
    assert {e["name"] for e in data["exclusions"]} == {"Schweinefleisch"}
