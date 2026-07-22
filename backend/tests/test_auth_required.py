"""BUG-43: Content-Reads antworten nur noch mit Login.

Bis hierher liefen Rezept-Liste, -Detail, `/random`, Step-Zutaten, Ratings und
der Media-Status über `get_optional_user` — ohne Token kamen also Daten zurück.
Diese Tests halten fest, dass daraus jetzt 401 wird, und dass der eine bewusst
öffentliche Pfad (Bring!-Klon) das *nicht* mitmacht.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.bring.router import router as bring_router
from app.database import get_db
from app.ratings.router import router as ratings_router
from app.recipes.router import router as recipes_router
from tests.dbfixtures import make_session_factory


def _client(*routers):
    """App ohne Auth-Override — Requests laufen ohne Authorization-Header."""
    Session = make_session_factory()
    app = FastAPI()
    for router in routers:
        app.include_router(router)
    app.dependency_overrides[get_db] = lambda: Session()
    return TestClient(app)


@pytest.fixture
def client():
    return _client(recipes_router, ratings_router, bring_router)


@pytest.mark.parametrize("pfad", [
    "/api/recipes",
    "/api/recipes/random",
    "/api/recipes/1",
    "/api/recipes/1/steps/1/ingredients",
    "/api/recipes/1/rating",
])
def test_read_ohne_token_ist_401(client, pfad):
    assert client.get(pfad).status_code == 401


def test_media_status_ohne_token_ist_401():
    # Der Media-Router bringt Upload-Routen mit und laesst sich nur mit
    # python-multipart einbinden (in requirements.txt, aber nicht zwingend im
    # lokalen Interpreter) — deshalb eigener Client statt der Fixture.
    pytest.importorskip("multipart", reason="python-multipart nicht installiert")
    from app.media.router import router as media_router

    assert _client(media_router).get("/api/media/status/1").status_code == 401


def test_share_token_im_query_oeffnet_rezept_nicht_mehr(client):
    # Der `token`-Query-Parameter am Detail-Endpoint greift erst nach der
    # Auth-Dependency — ohne Login kommt man auch damit nicht mehr durch.
    assert client.get("/api/recipes/1?token=egal").status_code == 401


def test_bring_klon_bleibt_ohne_login_erreichbar(client):
    """Carve-out: der Bring!-Crawler hat keinen Login, der Token autorisiert.

    Ein unbekannter Token ist 410 („Link abgelaufen") — entscheidend ist, dass
    hier *kein* 401 steht, der Endpoint also weiterhin ohne Auth antwortet.
    """
    r = client.get("/api/share/recipe/kein-gueltiger-token")
    assert r.status_code == 410
