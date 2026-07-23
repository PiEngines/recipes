"""Tests für das Ernährungsprofil (Ü18, Commit 3).

Übt PATCH /api/users/me (Schreibpfad), GET /api/exclusions (Read) und die
Auflösung in der eigenen Sicht aus — gegen eine echte SQLite-Session.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import User
from app.models.category import Allergen, DietLabel, Exclusion
from app.models.user import UserRole
from app.taxonomy.router import router as taxonomy_router
from app.users.router import router as users_router
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    ich = make_user(db, 1, "ich", UserRole.koch)
    # Minimaler Seed der Auswahlwerte (die Migration macht das im Deploy).
    db.add_all([
        DietLabel(id=1, name="Vegetarisch"),
        DietLabel(id=2, name="Vegan"),
        Allergen(id=1, name="Gluten"),
        Allergen(id=2, name="Milch/Laktose"),
        Exclusion(id=1, name="Schweinefleisch"),
        Exclusion(id=2, name="Alkohol"),
    ])
    db.commit()

    app = FastAPI()
    app.include_router(users_router)
    app.include_router(taxonomy_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: ich

    yield TestClient(app), db, ich
    db.close()


# ── Read-Endpoint ────────────────────────────────────────────────────────────

def test_exclusions_endpoint_liefert_sortiert(ctx):
    c, _, _ = ctx
    r = c.get("/api/exclusions")
    assert r.status_code == 200
    namen = [e["name"] for e in r.json()]
    assert namen == ["Alkohol", "Schweinefleisch"]  # nach Name sortiert


# ── Schreibpfad ──────────────────────────────────────────────────────────────

def test_listen_setzen_und_am_user_ankommen(ctx):
    c, db, ich = ctx
    r = c.patch("/api/users/me", json={
        "diet_label_ids": [1, 2],
        "allergen_ids": [1],
        "exclusion_ids": [2],
    })
    assert r.status_code == 200
    db.refresh(ich)
    assert {d.id for d in ich.diet_labels} == {1, 2}
    assert {a.id for a in ich.allergens} == {1}
    assert {e.id for e in ich.exclusions} == {2}


def test_leere_liste_waehlt_alles_ab(ctx):
    c, db, ich = ctx
    c.patch("/api/users/me", json={"diet_label_ids": [1, 2]})
    c.patch("/api/users/me", json={"diet_label_ids": []})
    db.refresh(ich)
    assert ich.diet_labels == []


def test_none_laesst_die_liste_unangetastet(ctx):
    c, db, ich = ctx
    c.patch("/api/users/me", json={"diet_label_ids": [1]})
    # Ein PATCH ohne das Feld ändert die Diät nicht.
    c.patch("/api/users/me", json={"bio": "hallo"})
    db.refresh(ich)
    assert {d.id for d in ich.diet_labels} == {1}


def test_unbekannte_id_422(ctx):
    c, _, _ = ctx
    r = c.patch("/api/users/me", json={"allergen_ids": [1, 999]})
    assert r.status_code == 422
    assert "999" in str(r.json()["detail"])


def test_duplikate_werden_zusammengefasst(ctx):
    c, db, ich = ctx
    r = c.patch("/api/users/me", json={"exclusion_ids": [1, 1, 2]})
    assert r.status_code == 200
    db.refresh(ich)
    assert {e.id for e in ich.exclusions} == {1, 2}


# ── Sichtbarkeits-Flags ──────────────────────────────────────────────────────

def test_flags_sind_initial_false_und_umschaltbar(ctx):
    c, db, ich = ctx
    db.refresh(ich)
    assert ich.diet_public is False
    assert ich.exclusions_public is False

    c.patch("/api/users/me", json={"diet_public": True, "exclusions_public": True})
    db.refresh(ich)
    assert ich.diet_public is True
    assert ich.exclusions_public is True


def test_kein_allergen_flag_existiert():
    """Allergien sind nie öffentlich — es gibt bewusst keinen Toggle."""
    from app.users.router import PatchMeBody
    assert "allergens_public" not in PatchMeBody.model_fields


# ── Eigene Sicht (/auth/me) ──────────────────────────────────────────────────

def test_auth_me_loest_alle_drei_auf(ctx):
    """UserResponse (die /auth/me-Antwort) trägt alle drei Listen aufgelöst —
    auch die Allergien, weil das die eigene Sicht ist."""
    from app.auth.schemas import UserResponse

    c, db, ich = ctx
    c.patch("/api/users/me", json={
        "diet_label_ids": [1],
        "allergen_ids": [1, 2],
        "exclusion_ids": [2],
    })
    db.refresh(ich)

    antwort = UserResponse.model_validate(ich)
    assert [d.name for d in antwort.diet_labels] == ["Vegetarisch"]
    assert {a.id for a in antwort.allergens} == {1, 2}
    assert [e.name for e in antwort.exclusions] == ["Alkohol"]
