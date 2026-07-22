"""Tests für POST /api/auth/refresh (BUG-30).

Der Endpoint ist die einzige Stelle, an der ein Refresh-Token eingelöst wird —
er muss ein Access-Token zuverlässig abweisen, sonst liesse sich der
60-Minuten-Ablauf endlos verlängern.

Übt gegen eine echte SQLite-Session aus, nicht gegen die gemockte Session aus
conftest.py.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from app.auth.router import router as auth_router
from app.config import settings
from app.database import get_db
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    """App + Session mit einer aktiven und einer deaktivierten Nutzerin."""
    Session = make_session_factory()
    db = Session()
    make_user(db, 1, "koechin", UserRole.koch)
    gesperrt = make_user(db, 2, "gesperrt", UserRole.koch)
    gesperrt.is_active = False
    db.commit()

    app = FastAPI()
    app.include_router(auth_router)
    app.dependency_overrides[get_db] = lambda: Session()

    yield TestClient(app)
    db.close()


def _abgelaufenes_refresh_token(user_id: int) -> str:
    """Wie `create_refresh_token`, nur mit `exp` in der Vergangenheit."""
    return jwt.encode(
        {
            "sub": str(user_id),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            "type": "refresh",
        },
        settings.secret_key,
        algorithm="HS256",
    )


def test_gueltiges_refresh_token_liefert_neues_access_token(ctx):
    r = ctx.post("/api/auth/refresh", json={"refresh_token": create_refresh_token(1)})
    assert r.status_code == 200

    payload = decode_token(r.json()["access_token"])
    assert payload["type"] == "access"
    assert payload["sub"] == "1"


def test_refresh_token_wird_unveraendert_zurueckgegeben(ctx):
    # Bewusst keine Rotation: parallele Requests dürfen denselben Token
    # mehrfach einlösen.
    token = create_refresh_token(1)
    r = ctx.post("/api/auth/refresh", json={"refresh_token": token})
    assert r.json()["refresh_token"] == token


def test_access_token_als_refresh_ist_401(ctx):
    r = ctx.post("/api/auth/refresh", json={"refresh_token": create_access_token(1)})
    assert r.status_code == 401


def test_abgelaufenes_refresh_token_ist_401(ctx):
    r = ctx.post("/api/auth/refresh", json={"refresh_token": _abgelaufenes_refresh_token(1)})
    assert r.status_code == 401


def test_muell_ist_401(ctx):
    r = ctx.post("/api/auth/refresh", json={"refresh_token": "kein.jwt.hier"})
    assert r.status_code == 401


def test_unbekannter_user_ist_401(ctx):
    r = ctx.post("/api/auth/refresh", json={"refresh_token": create_refresh_token(999)})
    assert r.status_code == 401


def test_deaktivierter_user_ist_401(ctx):
    r = ctx.post("/api/auth/refresh", json={"refresh_token": create_refresh_token(2)})
    assert r.status_code == 401
