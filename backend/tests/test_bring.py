"""Tests für die Bring!-Integration (Mint-Permission, Klon, Token, Escaping)."""
import json
import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from app.auth.dependencies import get_current_user
from app.bring.router import router as bring_router
from app.bring.tokens import create_share_token, read_share_token
from app.config import settings
from app.database import get_db
from app.models import Ingredient, Recipe
from app.models.access import RecipeAccess
from app.models.media import Media
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user

JETZT = datetime.now(timezone.utc)


@pytest.fixture
def ctx():
    """App + Session mit Rezepten in allen Freigabe-Zuständen."""
    Session = make_session_factory()
    db = Session()
    users = {
        "autor": make_user(db, 1, "autor", UserRole.koch),
        "fremder": make_user(db, 2, "fremder", UserRole.koch),
        "chef": make_user(db, 3, "chef", UserRole.chefkoch),
        "hilfe": make_user(db, 4, "hilfe", UserRole.kuechenhilfe),
        "leser": make_user(db, 5, "leser", UserRole.koch),
    }
    for rid, titel in [
        (1, 'Kürbissuppe mit "Ingwer" & Chili'),   # privat
        (2, "Oeffentlich"),                         # free_for_all
        (3, "PrivatMitLeser"),                      # individuell freigegeben
        (4, "Abgelaufen"),                          # free_for_all, abgelaufen
        (5, "Abgelehnt"),                           # free_for_all, abgelehnt
        (6, "Geloescht"),
    ]:
        db.add(Recipe(id=rid, title=titel, servings=4, created_by=1, author_id=1))
    db.commit()

    db.query(Recipe).filter(Recipe.id == 6).update({"deleted_at": JETZT})
    db.add(RecipeAccess(recipe_id=2, access_type="free_for_all", created_by=1))
    db.add(RecipeAccess(recipe_id=3, access_type="individual", email="leser@test.de", created_by=1))
    db.add(RecipeAccess(recipe_id=4, access_type="free_for_all", created_by=1,
                        expires_at=JETZT - timedelta(days=1)))
    db.add(RecipeAccess(recipe_id=5, access_type="free_for_all", created_by=1,
                        declined_at=JETZT - timedelta(days=1)))
    for iid, name, amount, unit, so in [
        (10, "Hokkaido-Kürbis", "800", "g", 0),
        (11, "Ingwer, frisch", "30", "g", 1),
        (12, "Salz", None, None, 2),
    ]:
        db.add(Ingredient(id=iid, recipe_id=1, name=name, amount=amount, unit=unit, sort_order=so))
    db.add(Media(id=1, entity_type="recipe", entity_id=1, media_type="image",
                 filename="k.webp", storage_path="recipe/1/images/k.webp",
                 processing_status="ready", is_primary=True, uploaded_by=1))
    db.commit()

    aktuell = {"u": users["autor"]}
    app = FastAPI()
    app.include_router(bring_router)
    app.dependency_overrides[get_db] = lambda: Session()
    app.dependency_overrides[get_current_user] = lambda: aktuell["u"]

    client = TestClient(app)

    def mint(username, recipe_id):
        aktuell["u"] = users[username]
        return client.post(f"/api/recipes/{recipe_id}/bring-link")

    yield client, db, mint
    db.close()


def ld_of(html_text):
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html_text, re.S)
    return json.loads(m.group(1)) if m else None


# ── Mint-Permission ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("user,recipe_id,erwartet", [
    ("autor", 1, 200),      # Autor auf eigenem privaten Rezept
    ("chef", 1, 200),       # Redaktion auf fremdem privaten Rezept
    ("fremder", 2, 200),    # Kern-Use-Case: fremder User, öffentliches Rezept
    ("hilfe", 2, 200),      # jeder Eingeloggte bei free_for_all
    ("fremder", 1, 403),    # fremdes, nicht-öffentliches Rezept
    ("hilfe", 1, 403),
    ("leser", 3, 403),      # individuell freigegeben ⇒ kein Re-Share
    ("fremder", 4, 403),    # free_for_all abgelaufen
    ("fremder", 5, 403),    # free_for_all abgelehnt
])
def test_mint_permission_matrix(ctx, user, recipe_id, erwartet):
    _, _, mint = ctx
    assert mint(user, recipe_id).status_code == erwartet


def test_mint_unbekanntes_rezept_404(ctx):
    _, _, mint = ctx
    assert mint("fremder", 999).status_code == 404


def test_mint_url_absolut_und_ohne_rezept_id(ctx):
    _, _, mint = ctx
    url = mint("autor", 1).json()["url"]
    assert url.startswith(f"{settings.app_url}/api/share/recipe/")
    assert not url.endswith("/1")


def test_token_eines_fremden_users_oeffnet_den_klon(ctx):
    client, _, mint = ctx
    token = mint("fremder", 2).json()["url"].rsplit("/", 1)[-1]
    r = client.get(f"/api/share/recipe/{token}")
    assert r.status_code == 200
    assert "Oeffentlich" in r.text


# ── Token ────────────────────────────────────────────────────────────────────

def test_token_roundtrip():
    assert read_share_token(create_share_token(42)) == 42


def test_muelltoken_und_manipuliert():
    assert read_share_token("kein.echter.token") is None
    tok = create_share_token(1)
    assert read_share_token(tok[:-3] + "aaa") is None


def test_access_token_gilt_nicht_als_share_token():
    """Der eigene type verhindert, dass ein Login-Token den Klon öffnet."""
    access = jwt.encode(
        {"sub": "1", "exp": JETZT + timedelta(minutes=60), "type": "access"},
        settings.secret_key, algorithm="HS256")
    assert read_share_token(access) is None


def test_abgelaufener_token():
    abgelaufen = jwt.encode(
        {"rid": 1, "exp": JETZT - timedelta(seconds=5), "type": "bring_share"},
        settings.secret_key, algorithm="HS256")
    assert read_share_token(abgelaufen) is None


def test_ttl_default_1800():
    assert settings.bring_link_ttl_seconds == 1800


# ── Klon-Endpoint ────────────────────────────────────────────────────────────

def test_klon_liefert_noindex_doppelt(ctx):
    client, _, mint = ctx
    token = mint("autor", 1).json()["url"].rsplit("/", 1)[-1]
    r = client.get(f"/api/share/recipe/{token}")
    assert r.status_code == 200
    assert r.headers["x-robots-tag"] == "noindex"
    assert '<meta name="robots" content="noindex">' in r.text


def test_json_ld_pflichtfelder(ctx):
    client, _, mint = ctx
    token = mint("autor", 1).json()["url"].rsplit("/", 1)[-1]
    ld = ld_of(client.get(f"/api/share/recipe/{token}").text)

    assert ld["@context"] == "https://schema.org"
    assert ld["@type"] == "Recipe"
    assert ld["name"] == 'Kürbissuppe mit "Ingwer" & Chili'
    assert ld["author"]["name"] == "autor"
    assert ld["recipeIngredient"] == ["800 g Hokkaido-Kürbis", "30 g Ingwer, frisch", "Salz"]
    assert ld["recipeYield"] == "4"
    assert ld["image"] == f"{settings.app_url}/media/recipe/1/images/k.webp"
    # Datensparsamkeit: Bring! braucht nur die Zutaten
    assert "recipeInstructions" not in ld


def test_script_escape_im_titel(ctx):
    """Ein </script> im Rezepttitel darf den JSON-LD-Block nicht sprengen."""
    client, db, mint = ctx
    db.add(Recipe(id=7, title="Ausbruch </script><script>alert(1)</script>",
                  servings=1, created_by=1, author_id=1))
    db.commit()

    token = mint("autor", 7).json()["url"].rsplit("/", 1)[-1]
    text = client.get(f"/api/share/recipe/{token}").text

    bloecke = re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)
    assert len(bloecke) == 1
    assert "<" not in bloecke[0]                       # als < kodiert
    assert text.count("<script") == 1                  # kein eingeschleustes Script
    assert json.loads(bloecke[0])["name"].startswith("Ausbruch")


@pytest.mark.parametrize("token", ["quatsch", "a.b.c"])
def test_ungueltiger_token_410(ctx, token):
    client, _, _ = ctx
    assert client.get(f"/api/share/recipe/{token}").status_code == 410


def test_abgelaufener_token_410(ctx):
    client, _, _ = ctx
    abgelaufen = jwt.encode(
        {"rid": 1, "exp": JETZT - timedelta(seconds=5), "type": "bring_share"},
        settings.secret_key, algorithm="HS256")
    assert client.get(f"/api/share/recipe/{abgelaufen}").status_code == 410


def test_access_token_am_klon_410(ctx):
    client, _, _ = ctx
    access = jwt.encode(
        {"sub": "1", "exp": JETZT + timedelta(minutes=60), "type": "access"},
        settings.secret_key, algorithm="HS256")
    assert client.get(f"/api/share/recipe/{access}").status_code == 410


def test_geloeschtes_rezept_404(ctx):
    client, _, _ = ctx
    assert client.get(f"/api/share/recipe/{create_share_token(6)}").status_code == 404


def test_nicht_publiziertes_rezept_404(ctx):
    client, db, _ = ctx
    db.add(Recipe(id=8, title="Unpubliziert", servings=1, created_by=1, author_id=1))
    db.commit()
    db.query(Recipe).filter(Recipe.id == 8).update({"status": "entwurf"})
    db.commit()
    assert client.get(f"/api/share/recipe/{create_share_token(8)}").status_code == 404


def test_klon_ist_zustandslos(ctx):
    """HTML wird pro Request frisch gerendert — nichts gecacht."""
    client, db, mint = ctx
    token = mint("autor", 1).json()["url"].rsplit("/", 1)[-1]
    vorher = client.get(f"/api/share/recipe/{token}").text

    db.query(Recipe).filter(Recipe.id == 1).update({"title": "Umbenannt"})
    db.commit()
    nachher = client.get(f"/api/share/recipe/{token}").text

    assert "Umbenannt" not in vorher
    assert "Umbenannt" in nachher


def test_klon_braucht_kein_auth(ctx):
    """Der Bring!-Server kann sich nicht anmelden — der Token autorisiert."""
    client, _, mint = ctx
    token = mint("autor", 1).json()["url"].rsplit("/", 1)[-1]
    assert client.get(f"/api/share/recipe/{token}",
                      headers={"Authorization": ""}).status_code == 200
