"""Tests für die Post↔Rezept-Verknüpfung (F3b-1 · Commit 3).

Kein Netzwerk: `fetch_oembed` ist durchgängig als fehlgeschlagen gemockt — die
Anreicherung ist hier nicht das Thema.
"""
from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.external_posts.oembed import OEmbedError
from app.external_posts.router import router as posts_router
from app.models import ExternalPost, Recipe
from app.models.recipe import RecipeStatus
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user

TIKTOK = "https://www.tiktok.com/@koch/video/12345"


@pytest.fixture(autouse=True)
def kein_netz():
    with patch(
        "app.external_posts.router.fetch_oembed",
        side_effect=OEmbedError("in Tests nicht abgerufen"),
    ):
        yield


def _rezept(db, recipe_id, titel, status=RecipeStatus.published, deleted_at=None):
    rezept = Recipe(
        id=recipe_id,
        title=titel,
        created_by=1,
        status=status,
        deleted_at=deleted_at,
    )
    db.add(rezept)
    return rezept


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    users = {
        "ich": make_user(db, 1, "ich", UserRole.koch),
        "fremd": make_user(db, 2, "fremd", UserRole.koch),
    }
    _rezept(db, 10, "Ofengemüse")
    _rezept(db, 11, "Entwurf", status=RecipeStatus.draft)
    _rezept(db, 12, "Geloescht", deleted_at=datetime(2026, 1, 1))
    db.commit()

    aktuell = {"u": users["ich"]}
    app = FastAPI()
    app.include_router(posts_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: aktuell["u"]

    def als(name):
        aktuell["u"] = users[name]

    yield TestClient(app), db, als
    db.close()


def _post(c):
    return c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK}).json()["id"]


# ── Verknüpfen ───────────────────────────────────────────────────────────────

def test_neu_angelegter_post_ist_unverknuepft(ctx):
    c, _, _ = ctx
    body = c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK}).json()
    assert body["recipe_id"] is None
    assert body["recipe_title"] is None


def test_verknuepfen(ctx):
    c, db, _ = ctx
    pid = _post(c)

    r = c.patch(f"/api/external-posts/{pid}", json={"recipe_id": 10})
    assert r.status_code == 200
    assert r.json()["recipe_id"] == 10
    # Der Titel trägt den „Rezept ansehen"-Button.
    assert r.json()["recipe_title"] == "Ofengemüse"
    assert db.query(ExternalPost).one().recipe_id == 10


def test_detail_liefert_titel_nach(ctx):
    c, _, _ = ctx
    pid = _post(c)
    c.patch(f"/api/external-posts/{pid}", json={"recipe_id": 10})

    body = c.get(f"/api/external-posts/{pid}").json()
    assert (body["recipe_id"], body["recipe_title"]) == (10, "Ofengemüse")


def test_loesen(ctx):
    c, db, _ = ctx
    pid = _post(c)
    c.patch(f"/api/external-posts/{pid}", json={"recipe_id": 10})

    r = c.patch(f"/api/external-posts/{pid}", json={"recipe_id": None})
    assert r.json()["recipe_id"] is None
    assert r.json()["recipe_title"] is None
    assert db.query(ExternalPost).one().recipe_id is None


def test_umhaengen(ctx):
    c, db, _ = ctx
    _rezept(db, 13, "Zweites Rezept")
    db.commit()

    pid = _post(c)
    c.patch(f"/api/external-posts/{pid}", json={"recipe_id": 10})
    r = c.patch(f"/api/external-posts/{pid}", json={"recipe_id": 13})

    assert r.json()["recipe_id"] == 13
    assert r.json()["recipe_title"] == "Zweites Rezept"


def test_mehrere_posts_an_einem_rezept(ctx):
    """Ein Rezept darf von vielen Beiträgen referenziert werden."""
    c, db, _ = ctx
    for _ in range(3):
        c.patch(f"/api/external-posts/{_post(c)}", json={"recipe_id": 10})

    assert db.query(ExternalPost).filter(ExternalPost.recipe_id == 10).count() == 3


# ── Ungültige Ziele ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("recipe_id,warum", [
    (9999, "existiert nicht"),
    (11, "Entwurf"),
    (12, "geloescht"),
])
def test_ungueltiges_rezept_400(ctx, recipe_id, warum):
    c, db, _ = ctx
    pid = _post(c)

    r = c.patch(f"/api/external-posts/{pid}", json={"recipe_id": recipe_id})
    assert r.status_code == 400, warum
    assert db.query(ExternalPost).one().recipe_id is None


def test_verknuepfen_nur_owner(ctx):
    c, db, als = ctx
    pid = _post(c)
    als("fremd")
    assert c.patch(f"/api/external-posts/{pid}", json={"recipe_id": 10}).status_code == 403
    assert db.query(ExternalPost).one().recipe_id is None


def test_andere_felder_bleiben_bei_fehlschlag_unveraendert(ctx):
    """Geprüft wird vor dem Schreiben — ein abgelehntes `recipe_id` darf keine
    halb angewandte Caption-Änderung hinterlassen."""
    c, db, _ = ctx
    pid = _post(c)

    r = c.patch(f"/api/external-posts/{pid}", json={
        "caption_text": "200 g Feta",
        "recipe_id": 9999,
    })
    assert r.status_code == 400
    assert db.query(ExternalPost).one().caption_text is None


# ── SET NULL ─────────────────────────────────────────────────────────────────

def test_geloeschtes_rezept_nimmt_den_post_nicht_mit(ctx):
    """FK ondelete=SET NULL: die Verknüpfung fällt weg, der Beitrag bleibt."""
    c, db, _ = ctx
    pid = _post(c)
    c.patch(f"/api/external-posts/{pid}", json={"recipe_id": 10})

    # SQLite erzwingt Fremdschlüssel nur mit gesetztem PRAGMA (Postgres immer).
    db.execute(text("PRAGMA foreign_keys=ON"))
    db.delete(db.query(Recipe).filter(Recipe.id == 10).one())
    db.commit()

    post = db.query(ExternalPost).one()
    assert post.id == pid
    assert post.recipe_id is None
