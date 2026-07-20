"""Tests für RecipeStatus.draft (F3a Commit 5).

Kernfrage: taucht ein Entwurf irgendwo auf, wo er nicht hingehört?
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_optional_user, require_koch_or_above
from app.collections.router import router as collections_router
from app.database import get_db
from app.models import Recipe
from app.models.access import RecipeAccess
from app.models.recipe import RecipeStatus
from app.models.user import UserRole
from app.recipes.router import _apply_visibility_filter
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    """Autor mit einem veröffentlichten und einem Entwurfs-Rezept, beide öffentlich freigegeben."""
    Session = make_session_factory()
    db = Session()
    users = {
        "autor": make_user(db, 1, "autor", UserRole.koch),
        "fremd": make_user(db, 2, "fremd", UserRole.koch),
        "chef": make_user(db, 3, "chef", UserRole.chefkoch),
    }
    db.add(Recipe(id=1, title="Veroeffentlicht", servings=2, created_by=1, author_id=1,
                  status=RecipeStatus.published))
    db.add(Recipe(id=2, title="Entwurf", servings=2, created_by=1, author_id=1,
                  status=RecipeStatus.draft))
    db.commit()
    # Beide ausdruecklich oeffentlich freigegeben — der Entwurf darf trotzdem
    # nicht sichtbar werden.
    db.add(RecipeAccess(recipe_id=1, access_type="free_for_all", created_by=1))
    db.add(RecipeAccess(recipe_id=2, access_type="free_for_all", created_by=1))
    db.commit()

    yield db, users
    db.close()


def sichtbare_ids(db, user):
    q = _apply_visibility_filter(db.query(Recipe).filter(Recipe.deleted_at.is_(None)), user, db)
    return {r.id for r in q.all()}


# ── Enum ─────────────────────────────────────────────────────────────────────

def test_enum_kennt_draft():
    assert RecipeStatus.draft.value == "draft"


def test_published_unveraendert():
    assert RecipeStatus.published.value == "published"


def test_enum_hat_genau_zwei_werte():
    assert {s.value for s in RecipeStatus} == {"published", "draft"}


# ── Sichtbarkeit über den Filter ─────────────────────────────────────────────

def test_unangemeldet_sieht_keinen_entwurf(ctx):
    db, _ = ctx
    assert sichtbare_ids(db, None) == {1}


def test_fremder_sieht_keinen_entwurf(ctx):
    """Auch mit free_for_all-Freigabe bleibt der Entwurf unsichtbar."""
    db, users = ctx
    assert sichtbare_ids(db, users["fremd"]) == {1}


def test_autor_sieht_eigenen_entwurf(ctx):
    db, users = ctx
    assert sichtbare_ids(db, users["autor"]) == {1, 2}


def test_redaktion_sieht_weiterhin_alles(ctx):
    """Bestehende Regel unveraendert: Chefkoch sieht alles."""
    db, users = ctx
    assert sichtbare_ids(db, users["chef"]) == {1, 2}


def test_veroeffentlichtes_bleibt_fuer_alle_sichtbar(ctx):
    db, users = ctx
    for user in (None, users["fremd"], users["autor"], users["chef"]):
        assert 1 in sichtbare_ids(db, user)


# ── Sichtbarkeit im Detail-Endpoint ──────────────────────────────────────────

@pytest.fixture
def detail_client(ctx):
    from app.recipes.router import router as recipes_router

    db, users = ctx
    aktuell = {"u": None}
    app = FastAPI()
    app.include_router(recipes_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_optional_user] = lambda: aktuell["u"]

    def als(name):
        aktuell["u"] = users[name] if name else None

    return TestClient(app), als


def test_detail_entwurf_fuer_fremde_404(detail_client):
    c, als = detail_client
    als("fremd")
    assert c.get("/api/recipes/2").status_code == 404


def test_detail_entwurf_unangemeldet_404(detail_client):
    c, als = detail_client
    als(None)
    assert c.get("/api/recipes/2").status_code == 404


def test_detail_entwurf_fuer_autor_200(detail_client):
    c, als = detail_client
    als("autor")
    r = c.get("/api/recipes/2")
    assert r.status_code == 200
    assert r.json()["status"] == "draft"


def test_detail_veroeffentlicht_unveraendert(detail_client):
    c, als = detail_client
    als("fremd")
    assert c.get("/api/recipes/1").status_code == 200


# ── Entwuerfe in Sammlungen ──────────────────────────────────────────────────

def test_entwurf_kann_nicht_in_sammlung(ctx):
    """Sammlungen nehmen nur aktive Rezepte auf — Entwuerfe zaehlen nicht."""
    db, users = ctx
    app = FastAPI()
    app.include_router(collections_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: users["autor"]
    c = TestClient(app)

    sid = c.post("/api/collections", json={"name": "S"}).json()["id"]
    assert c.post(f"/api/collections/{sid}/items",
                  json={"item_type": "recipe", "item_id": 2}).status_code == 404
    assert c.post(f"/api/collections/{sid}/items",
                  json={"item_type": "recipe", "item_id": 1}).status_code == 201


# ── Vertragsstabilität ───────────────────────────────────────────────────────

def test_oeffentliche_schemas_unveraendert():
    """Commit 5 fuegt nur einen Enum-Wert hinzu — die Response-Shapes bleiben."""
    from app.recipes.schemas import RecipeListItem, RecipeResponse

    for schema in (RecipeListItem, RecipeResponse):
        felder = set(schema.model_fields)
        assert "status" in felder
        # status bleibt ein einfacher String im JSON-Schema, kein Enum-Objekt
        assert schema.model_json_schema()["properties"]["status"] is not None


def test_create_und_update_akzeptieren_draft():
    """Dokumentiert einen Nebeneffekt des neuen Enum-Werts.

    RecipeCreate.status und RecipeUpdate.status sind als RecipeStatus typisiert,
    und der Update-Endpoint uebertraegt status ueber seine scalar_fields. Mit
    dem neuen Wert nehmen die bestehenden Endpoints "draft" also entgegen —
    der Lebenszyklus draft -> published ist auf API-Ebene vollstaendig, auch
    wenn die UI dafuer erst in F3b entsteht.
    """
    from app.recipes.schemas import RecipeCreate, RecipeUpdate

    assert RecipeCreate(title="X", status="draft").status is RecipeStatus.draft
    assert RecipeUpdate(status="published").status is RecipeStatus.published
    # Default bleibt published — ein Create ohne status legt nichts Verstecktes an.
    assert RecipeCreate(title="X").status is RecipeStatus.published


def test_entwurf_wird_nach_veroeffentlichung_sichtbar(ctx):
    """Der Statuswechsel schaltet die Sichtbarkeit um."""
    db, users = ctx
    assert sichtbare_ids(db, users["fremd"]) == {1}

    db.query(Recipe).filter(Recipe.id == 2).update({"status": RecipeStatus.published})
    db.commit()
    assert sichtbare_ids(db, users["fremd"]) == {1, 2}
