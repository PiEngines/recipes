"""Tests für User.bio (F3a Commit 1).

Übt PATCH /api/users/me gegen eine echte SQLite-Session aus.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import User
from app.models.user import UserRole
from app.users.router import UserListItem, router as users_router
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    ich = make_user(db, 1, "ich", UserRole.koch)
    db.commit()

    app = FastAPI()
    app.include_router(users_router)
    # Request und Fixture teilen sich die Session: `current_user` ist ein
    # persistentes ORM-Objekt, das der Endpoint committet und refresht — mit
    # zwei Sessions wäre es dort nicht persistent.
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: ich

    yield TestClient(app), db, ich
    db.close()


def test_bio_ist_initial_null(ctx):
    c, _, _ = ctx
    r = c.patch("/api/users/me", json={})
    assert r.status_code == 200
    assert r.json()["bio"] is None


def test_bio_setzen_und_auslesen(ctx):
    c, db, ich = ctx
    r = c.patch("/api/users/me", json={"bio": "Kocht gern mit Wildkräutern."})
    assert r.status_code == 200
    assert r.json()["bio"] == "Kocht gern mit Wildkräutern."

    db.refresh(ich)
    assert ich.bio == "Kocht gern mit Wildkräutern."


def test_bio_wird_getrimmt(ctx):
    c, _, _ = ctx
    r = c.patch("/api/users/me", json={"bio": "  mit Rand  "})
    assert r.json()["bio"] == "mit Rand"


def test_leerstring_loescht_die_bio(ctx):
    c, _, _ = ctx
    c.patch("/api/users/me", json={"bio": "steht drin"})
    r = c.patch("/api/users/me", json={"bio": ""})
    assert r.json()["bio"] is None


def test_bio_bleibt_bei_anderem_patch_erhalten(ctx):
    """Ein PATCH ohne bio darf sie nicht loeschen."""
    c, _, _ = ctx
    c.patch("/api/users/me", json={"bio": "bleibt"})
    r = c.patch("/api/users/me", json={"name": "Neuer Name"})
    assert r.json()["bio"] == "bleibt"
    assert r.json()["name"] == "Neuer Name"


def test_bio_ueber_500_zeichen_422(ctx):
    c, _, _ = ctx
    assert c.patch("/api/users/me", json={"bio": "x" * 501}).status_code == 422


def test_bio_genau_500_zeichen_erlaubt(ctx):
    c, _, _ = ctx
    r = c.patch("/api/users/me", json={"bio": "x" * 500})
    assert r.status_code == 200
    assert len(r.json()["bio"]) == 500


def test_bestandsfelder_unveraendert(ctx):
    """UserListItem wird nur additiv erweitert — die bisherigen Felder bleiben."""
    c, _, _ = ctx
    body = c.patch("/api/users/me", json={}).json()
    for feld in ("id", "name", "email", "username", "role", "status", "is_active", "created_at"):
        assert feld in body
    assert set(UserListItem.model_fields) == {
        "id", "name", "email", "username", "role", "status",
        "is_active", "created_at", "bio", "preferences", "preferences_public",
    }


def test_bio_ist_optional_im_schema():
    """`null` bleibt erlaubt — kein Pflichtfeld."""
    schema = UserListItem.model_json_schema()
    assert "bio" not in schema.get("required", [])


# ── Vorlieben (BUG-41) ───────────────────────────────────────────────────────

def test_vorlieben_sind_initial_null_und_privat(ctx):
    c, _, _ = ctx
    body = c.patch("/api/users/me", json={}).json()
    assert body["preferences"] is None
    assert body["preferences_public"] is False


def test_vorlieben_setzen_und_auslesen(ctx):
    c, db, ich = ctx
    r = c.patch("/api/users/me", json={"preferences": "Wenig Schärfe, viel Knoblauch."})
    assert r.status_code == 200
    assert r.json()["preferences"] == "Wenig Schärfe, viel Knoblauch."
    db.refresh(ich)
    assert ich.preferences == "Wenig Schärfe, viel Knoblauch."


def test_vorlieben_werden_getrimmt(ctx):
    c, _, _ = ctx
    assert c.patch("/api/users/me", json={"preferences": "  mit Rand  "}).json()["preferences"] == "mit Rand"


def test_leerstring_loescht_die_vorlieben(ctx):
    c, db, ich = ctx
    c.patch("/api/users/me", json={"preferences": "erst was"})
    r = c.patch("/api/users/me", json={"preferences": ""})
    assert r.json()["preferences"] is None
    db.refresh(ich)
    assert ich.preferences is None


def test_public_toggle_umschalten(ctx):
    c, db, ich = ctx
    r = c.patch("/api/users/me", json={"preferences_public": True})
    assert r.json()["preferences_public"] is True
    db.refresh(ich)
    assert ich.preferences_public is True

    r = c.patch("/api/users/me", json={"preferences_public": False})
    assert r.json()["preferences_public"] is False


def test_toggle_und_text_bleiben_unabhaengig(ctx):
    """Nur den Toggle setzen lässt den Text stehen und umgekehrt."""
    c, _, _ = ctx
    c.patch("/api/users/me", json={"preferences": "Text", "preferences_public": True})
    r = c.patch("/api/users/me", json={"preferences_public": False})
    assert r.json()["preferences"] == "Text"
    assert r.json()["preferences_public"] is False
