"""Tests für Mixed Collections (F3a Commit 4)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.dependencies import require_koch_or_above
from app.collections.router import router as collections_router, user_router
from app.database import get_db
from app.models import Collection, CollectionItem, ExternalPost, Recipe
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    users = {
        "ich": make_user(db, 1, "ich", UserRole.koch),
        "fremd": make_user(db, 2, "fremd", UserRole.koch),
    }
    db.add(Recipe(id=1, title="Sugo", servings=4, created_by=1, author_id=1))
    db.add(Recipe(id=2, title="Salat", servings=2, created_by=1, author_id=1))
    db.add(Recipe(id=3, title="Geloescht", servings=2, created_by=1, author_id=1))
    db.add(ExternalPost(id=1, created_by=1, platform="instagram",
                        url="https://instagram.com/p/A/"))
    db.commit()
    db.query(Recipe).filter(Recipe.id == 3).update({"deleted_at": text("CURRENT_TIMESTAMP")})
    db.commit()

    aktuell = {"u": users["ich"]}
    app = FastAPI()
    app.include_router(collections_router)
    app.include_router(user_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: aktuell["u"]

    def als(name):
        aktuell["u"] = users[name]

    yield TestClient(app), db, als
    db.close()


def neue_sammlung(c, name="Meine", visibility=None):
    body = {"name": name}
    if visibility:
        body["visibility"] = visibility
    return c.post("/api/collections", json=body).json()


# ── Anlegen / Sichtbarkeit ───────────────────────────────────────────────────

def test_anlegen_default_private(ctx):
    c, _, _ = ctx
    s = neue_sammlung(c)
    assert s["visibility"] == "private"
    assert s["item_count"] == 0


def test_anlegen_public(ctx):
    c, _, _ = ctx
    assert neue_sammlung(c, visibility="public")["visibility"] == "public"


def test_ungueltige_sichtbarkeit_422(ctx):
    c, _, _ = ctx
    assert c.post("/api/collections", json={"name": "X", "visibility": "geheim"}).status_code == 422


def test_eigene_liste_zeigt_beide_sichtbarkeiten(ctx):
    c, _, _ = ctx
    neue_sammlung(c, "A")
    neue_sammlung(c, "B", visibility="public")
    assert len(c.get("/api/collections").json()) == 2


def test_fremder_sieht_private_sammlung_nicht(ctx):
    c, _, als = ctx
    sid = neue_sammlung(c)["id"]
    als("fremd")
    assert c.get(f"/api/collections/{sid}").status_code == 404


def test_fremder_sieht_oeffentliche_sammlung(ctx):
    c, _, als = ctx
    sid = neue_sammlung(c, visibility="public")["id"]
    als("fremd")
    assert c.get(f"/api/collections/{sid}").status_code == 200


def test_owner_sieht_eigene_private_immer(ctx):
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    assert c.get(f"/api/collections/{sid}").status_code == 200


def test_profilsicht_nur_oeffentliche(ctx):
    c, _, als = ctx
    neue_sammlung(c, "privat")
    neue_sammlung(c, "oeffentlich", visibility="public")
    als("fremd")
    rows = c.get("/api/users/1/collections").json()
    assert [r["name"] for r in rows] == ["oeffentlich"]


# ── Items ────────────────────────────────────────────────────────────────────

def test_rezept_hinzufuegen(ctx):
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    r = c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 1})
    assert r.status_code == 201
    assert r.json()["item_count"] == 1


def test_dedup_innerhalb_einer_sammlung(ctx):
    c, db, _ = ctx
    sid = neue_sammlung(c)["id"]
    c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 1})
    r = c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 1})
    assert r.status_code == 201
    assert r.json()["item_count"] == 1
    assert db.query(CollectionItem).count() == 1


def test_dasselbe_rezept_in_mehreren_sammlungen(ctx):
    """Mehrfachzuordnung ueber Sammlungen hinweg ist ausdruecklich erlaubt."""
    c, db, _ = ctx
    a = neue_sammlung(c, "A")["id"]
    b = neue_sammlung(c, "B")["id"]
    assert c.post(f"/api/collections/{a}/items", json={"item_type": "recipe", "item_id": 1}).status_code == 201
    assert c.post(f"/api/collections/{b}/items", json={"item_type": "recipe", "item_id": 1}).status_code == 201
    assert db.query(CollectionItem).count() == 2


def test_gemischte_items_loesen_auf(ctx):
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 1})
    c.post(f"/api/collections/{sid}/items", json={"item_type": "external_post", "item_id": 1})

    items = c.get(f"/api/collections/{sid}").json()["items"]
    assert [i["item_type"] for i in items] == ["recipe", "external_post"]
    assert items[0]["recipe"]["title"] == "Sugo"
    assert items[1]["external_post"]["url"] == "https://instagram.com/p/A/"


def test_post_item_traegt_oembed_html(ctx):
    """F3b-2b: Die Detailseite spielt Beiträge ab. Der TikTok-Player entsteht
    nur aus `oembed_html` — ohne das Feld bliebe er in Sammlungen stumm
    (dieselbe Lehre wie in F3b-2a und F3b-3)."""
    c, db, _ = ctx
    db.add(ExternalPost(id=2, created_by=1, platform="tiktok",
                        url="https://tiktok.com/@koch/video/1",
                        oembed_html="<blockquote class='tiktok-embed'></blockquote>"))
    db.commit()

    sid = neue_sammlung(c)["id"]
    c.post(f"/api/collections/{sid}/items", json={"item_type": "external_post", "item_id": 2})

    post = c.get(f"/api/collections/{sid}").json()["items"][0]["external_post"]
    assert "tiktok-embed" in post["oembed_html"]


def test_post_item_bleibt_ohne_private_felder(ctx):
    """Vertrag: `oembed_html` kommt dazu, die Arbeitsfläche des Autors nicht."""
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    c.post(f"/api/collections/{sid}/items", json={"item_type": "external_post", "item_id": 1})

    post = c.get(f"/api/collections/{sid}").json()["items"][0]["external_post"]
    assert set(post) == {"id", "platform", "url", "thumbnail_url", "author_name", "oembed_html"}


def test_items_folgen_sort_order(ctx):
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 1})
    c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 2})
    items = c.get(f"/api/collections/{sid}").json()["items"]
    assert [i["item_id"] for i in items] == [1, 2]

    c.patch(f"/api/collections/{sid}/reorder", json=[
        {"item_type": "recipe", "item_id": 2, "sort_order": 0},
        {"item_type": "recipe", "item_id": 1, "sort_order": 1},
    ])
    items = c.get(f"/api/collections/{sid}").json()["items"]
    assert [i["item_id"] for i in items] == [2, 1]


def test_geloeschtes_rezept_kann_nicht_hinzugefuegt_werden(ctx):
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    assert c.post(f"/api/collections/{sid}/items",
                  json={"item_type": "recipe", "item_id": 3}).status_code == 404


def test_unbekanntes_item_404(ctx):
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    assert c.post(f"/api/collections/{sid}/items",
                  json={"item_type": "recipe", "item_id": 999}).status_code == 404
    assert c.post(f"/api/collections/{sid}/items",
                  json={"item_type": "external_post", "item_id": 999}).status_code == 404


def test_unbekannter_item_type_422(ctx):
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    assert c.post(f"/api/collections/{sid}/items",
                  json={"item_type": "pflanze", "item_id": 1}).status_code == 422


def test_item_entfernen(ctx):
    c, db, _ = ctx
    sid = neue_sammlung(c)["id"]
    c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 1})
    assert c.delete(f"/api/collections/{sid}/items/recipe/1").status_code == 204
    assert db.query(CollectionItem).count() == 0


def test_entfernen_trifft_nur_den_richtigen_typ(ctx):
    c, db, _ = ctx
    sid = neue_sammlung(c)["id"]
    c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 1})
    c.post(f"/api/collections/{sid}/items", json={"item_type": "external_post", "item_id": 1})
    c.delete(f"/api/collections/{sid}/items/recipe/1")
    rest = db.query(CollectionItem).all()
    assert len(rest) == 1 and rest[0].item_type == "external_post"


# ── Owner-Schutz ─────────────────────────────────────────────────────────────

def test_fremder_darf_nicht_patchen_loeschen_oder_befuellen(ctx):
    c, db, als = ctx
    sid = neue_sammlung(c, visibility="public")["id"]
    als("fremd")
    assert c.patch(f"/api/collections/{sid}", json={"name": "geklaut"}).status_code == 404
    assert c.delete(f"/api/collections/{sid}").status_code == 404
    assert c.post(f"/api/collections/{sid}/items",
                  json={"item_type": "recipe", "item_id": 1}).status_code == 404
    assert c.delete(f"/api/collections/{sid}/items/recipe/1").status_code == 404
    assert c.patch(f"/api/collections/{sid}/reorder", json=[]).status_code == 404
    assert db.query(Collection).count() == 1


def test_patch_aendert_name_und_sichtbarkeit(ctx):
    c, _, _ = ctx
    sid = neue_sammlung(c)["id"]
    r = c.patch(f"/api/collections/{sid}", json={"name": "Neu", "visibility": "public"})
    assert r.json()["name"] == "Neu"
    assert r.json()["visibility"] == "public"


# ── Cascade ──────────────────────────────────────────────────────────────────

def test_cascade_raeumt_items_beim_loeschen(ctx):
    c, db, _ = ctx
    sid = neue_sammlung(c)["id"]
    c.post(f"/api/collections/{sid}/items", json={"item_type": "recipe", "item_id": 1})
    c.post(f"/api/collections/{sid}/items", json={"item_type": "external_post", "item_id": 1})
    assert db.query(CollectionItem).count() == 2

    db.execute(text("PRAGMA foreign_keys=ON"))
    assert c.delete(f"/api/collections/{sid}").status_code == 204
    assert db.query(CollectionItem).count() == 0
