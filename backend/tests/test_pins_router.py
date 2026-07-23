"""Tests der Profil-Pins (/api/users/me/pins, Ü18).

Setzen, Auflösen, 3er-Cap, owner-only und übersprungene fehlende Ziele —
gegen eine echte SQLite-Session.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import ExternalPost, Recipe, User, UserPin
from app.models.external_post import ExternalPlatform
from app.models.user import UserRole
from app.pins.router import resolve_pins, router as pins_router
from tests.dbfixtures import make_session_factory, make_user


def _recipe(db, rid, autor):
    db.add(Recipe(id=rid, title=f"Rezept {rid}", servings=2, created_by=autor, author_id=autor))


def _post(db, pid, autor):
    db.add(ExternalPost(
        id=pid, platform=ExternalPlatform.tiktok, url=f"https://tiktok.com/{pid}",
        created_by=autor,
    ))


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    ich = make_user(db, 1, "ich", UserRole.koch)
    make_user(db, 2, "fremde", UserRole.koch)
    for rid in (10, 11, 12, 13):
        _recipe(db, rid, autor=1)
    _recipe(db, 90, autor=2)  # gehört der Fremden
    for pid in (20, 21):
        _post(db, pid, autor=1)
    db.commit()

    app = FastAPI()
    app.include_router(pins_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: ich

    yield TestClient(app), db, ich
    db.close()


def test_setzen_und_aufloesen_in_reihenfolge(ctx):
    c, _, _ = ctx
    r = c.put("/api/users/me/pins", json={"recipe_ids": [12, 10], "external_post_ids": [21]})
    assert r.status_code == 200
    body = r.json()
    assert [x["id"] for x in body["recipes"]] == [12, 10]  # Reihenfolge wie gesetzt
    assert [x["id"] for x in body["posts"]] == [21]


def test_get_liefert_die_gesetzten_pins(ctx):
    c, _, _ = ctx
    c.put("/api/users/me/pins", json={"recipe_ids": [10]})
    body = c.get("/api/users/me/pins").json()
    assert [x["id"] for x in body["recipes"]] == [10]


def test_erneutes_setzen_ersetzt(ctx):
    c, db, _ = ctx
    c.put("/api/users/me/pins", json={"recipe_ids": [10, 11]})
    c.put("/api/users/me/pins", json={"recipe_ids": [12]})
    body = c.get("/api/users/me/pins").json()
    assert [x["id"] for x in body["recipes"]] == [12]
    assert db.query(UserPin).count() == 1


def test_mehr_als_drei_je_typ_422(ctx):
    c, _, _ = ctx
    r = c.put("/api/users/me/pins", json={"recipe_ids": [10, 11, 12, 13]})
    assert r.status_code == 422


def test_fremdes_rezept_nicht_pinnbar_422(ctx):
    c, _, _ = ctx
    r = c.put("/api/users/me/pins", json={"recipe_ids": [90]})
    assert r.status_code == 422
    assert "90" in str(r.json()["detail"])


def test_unbekannte_id_422(ctx):
    c, _, _ = ctx
    assert c.put("/api/users/me/pins", json={"recipe_ids": [999]}).status_code == 422


def test_leere_listen_loeschen_die_pins(ctx):
    c, db, _ = ctx
    c.put("/api/users/me/pins", json={"recipe_ids": [10], "external_post_ids": [20]})
    c.put("/api/users/me/pins", json={"recipe_ids": [], "external_post_ids": []})
    assert db.query(UserPin).count() == 0


def test_fehlendes_ziel_wird_beim_aufloesen_uebersprungen(ctx):
    c, db, ich = ctx
    c.put("/api/users/me/pins", json={"recipe_ids": [10, 11]})
    # Rezept 10 verschwindet nachträglich (soft-delete).
    db.query(Recipe).filter(Recipe.id == 10).delete()
    db.commit()
    aufgeloest = resolve_pins(db, ich.id)
    assert [r.id for r in aufgeloest.recipes] == [11]


def test_duplikate_werden_zusammengefasst(ctx):
    c, _, _ = ctx
    r = c.put("/api/users/me/pins", json={"recipe_ids": [10, 10, 11]})
    assert r.status_code == 200
    assert [x["id"] for x in r.json()["recipes"]] == [10, 11]
