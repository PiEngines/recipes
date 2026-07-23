"""Tests für den Follow-Graph (F3a Commit 2)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.follows.router import router as follows_router
from app.models import User, UserFollow
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    users = {
        "ich": make_user(db, 1, "ich", UserRole.koch),
        "anna": make_user(db, 2, "anna", UserRole.koch),
        "bob": make_user(db, 3, "bob", UserRole.koch),
        "weg": make_user(db, 4, "weg", UserRole.koch),
    }
    db.commit()
    db.query(User).filter(User.id == 4).update({"deleted_at": text("CURRENT_TIMESTAMP")})
    db.commit()

    aktuell = {"u": users["ich"]}
    app = FastAPI()
    app.include_router(follows_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: aktuell["u"]

    def als(name):
        aktuell["u"] = users[name]

    yield TestClient(app), db, als, users
    db.close()


# ── Folgen / Entfolgen ───────────────────────────────────────────────────────

def test_follow_gibt_204_und_legt_kante_an(ctx):
    c, db, _, _ = ctx
    assert c.post("/api/users/2/follow").status_code == 204
    assert db.query(UserFollow).count() == 1


def test_self_follow_400(ctx):
    c, db, _, _ = ctx
    r = c.post("/api/users/1/follow")
    assert r.status_code == 400
    assert db.query(UserFollow).count() == 0


def test_doppeltes_follow_ist_idempotent(ctx):
    c, db, _, _ = ctx
    assert c.post("/api/users/2/follow").status_code == 204
    assert c.post("/api/users/2/follow").status_code == 204
    assert db.query(UserFollow).count() == 1


def test_follow_auf_unbekannten_user_404(ctx):
    c, _, _, _ = ctx
    assert c.post("/api/users/999/follow").status_code == 404


def test_follow_auf_geloeschten_user_404(ctx):
    c, _, _, _ = ctx
    assert c.post("/api/users/4/follow").status_code == 404


def test_unfollow_ist_idempotent(ctx):
    c, db, _, _ = ctx
    c.post("/api/users/2/follow")
    assert c.delete("/api/users/2/follow").status_code == 204
    assert c.delete("/api/users/2/follow").status_code == 204
    assert db.query(UserFollow).count() == 0


def test_unfollow_trifft_nur_die_eigene_kante(ctx):
    c, db, als, _ = ctx
    c.post("/api/users/3/follow")          # ich → bob
    als("anna")
    c.post("/api/users/3/follow")          # anna → bob
    c.delete("/api/users/3/follow")        # anna entfolgt
    assert db.query(UserFollow).count() == 1
    assert db.query(UserFollow).first().follower_id == 1


# ── Listen ───────────────────────────────────────────────────────────────────

def test_followers_und_following_listen(ctx):
    c, _, als, _ = ctx
    c.post("/api/users/3/follow")          # ich → bob
    als("anna")
    c.post("/api/users/3/follow")          # anna → bob

    followers = c.get("/api/users/3/followers").json()
    assert followers["total"] == 2
    assert {u["username"] for u in followers["items"]} == {"ich", "anna"}

    following = c.get("/api/users/1/following").json()
    assert following["total"] == 1
    assert following["items"][0]["username"] == "bob"


def test_listen_sind_paginiert(ctx):
    c, _, als, _ = ctx
    als("anna")
    c.post("/api/users/1/follow")
    als("bob")
    c.post("/api/users/1/follow")

    seite = c.get("/api/users/1/followers", params={"page": 1, "page_size": 1}).json()
    assert seite["total"] == 2
    assert len(seite["items"]) == 1
    assert seite["page_size"] == 1


def test_listen_kompaktes_schema(ctx):
    c, _, _, _ = ctx
    c.post("/api/users/2/follow")
    item = c.get("/api/users/2/followers").json()["items"][0]
    assert set(item) == {"id", "name", "username", "avatar_url"}
    assert "email" not in item          # keine Mailadressen in Profil-Listen


# ── Profil ───────────────────────────────────────────────────────────────────

def test_profil_zaehlt_korrekt(ctx):
    c, _, als, _ = ctx
    c.post("/api/users/2/follow")          # ich → anna
    als("bob")
    c.post("/api/users/2/follow")          # bob → anna

    profil = c.get("/api/users/2/profile").json()
    assert profil["follower_count"] == 2
    assert profil["following_count"] == 0
    assert profil["is_following"] is True  # Aufrufer ist bob


def test_is_following_ist_aufruferbezogen(ctx):
    c, _, als, _ = ctx
    c.post("/api/users/2/follow")
    assert c.get("/api/users/2/profile").json()["is_following"] is True
    als("bob")
    assert c.get("/api/users/2/profile").json()["is_following"] is False


def test_is_following_beim_eigenen_profil_false(ctx):
    c, _, _, _ = ctx
    assert c.get("/api/users/1/profile").json()["is_following"] is False


def test_counts_nach_unfollow(ctx):
    c, _, _, _ = ctx
    c.post("/api/users/2/follow")
    assert c.get("/api/users/2/profile").json()["follower_count"] == 1
    c.delete("/api/users/2/follow")
    assert c.get("/api/users/2/profile").json()["follower_count"] == 0


def test_profil_liefert_bio(ctx):
    c, db, _, users = ctx
    users["anna"].bio = "Backt Sauerteig."
    db.commit()
    assert c.get("/api/users/2/profile").json()["bio"] == "Backt Sauerteig."


def test_profil_auf_geloeschten_user_404(ctx):
    c, _, _, _ = ctx
    assert c.get("/api/users/4/profile").status_code == 404


def test_profil_zeigt_vorlieben_nur_wenn_freigegeben(ctx):
    c, db, _, users = ctx
    users["anna"].preferences = "Wenig Schärfe."
    users["anna"].preferences_public = False
    db.commit()
    # Privat → gar nicht erst über die Leitung.
    assert c.get("/api/users/2/profile").json()["preferences"] is None

    users["anna"].preferences_public = True
    db.commit()
    assert c.get("/api/users/2/profile").json()["preferences"] == "Wenig Schärfe."


def test_profil_zeigt_ernaehrungsprofil_nur_wenn_freigegeben(ctx):
    from app.models.category import Allergen, DietLabel, Exclusion

    c, db, _, users = ctx
    db.add_all([DietLabel(id=1, name="Vegan"), Exclusion(id=1, name="Alkohol"), Allergen(id=1, name="Gluten")])
    db.flush()
    anna = users["anna"]
    anna.diet_labels.append(db.get(DietLabel, 1))
    anna.exclusions.append(db.get(Exclusion, 1))
    anna.allergens.append(db.get(Allergen, 1))
    db.commit()

    # Beide privat → leer, Allergien tauchen ohnehin nie auf.
    profil = c.get("/api/users/2/profile").json()
    assert profil["diet_labels"] == []
    assert profil["exclusions"] == []
    assert "allergens" not in profil

    anna.diet_public = True
    anna.exclusions_public = True
    db.commit()
    profil = c.get("/api/users/2/profile").json()
    assert [d["name"] for d in profil["diet_labels"]] == ["Vegan"]
    assert [e["name"] for e in profil["exclusions"]] == ["Alkohol"]
    # Auch freigegeben bleiben Allergien aus der öffentlichen Sicht.
    assert "allergens" not in profil


def test_profil_schema_ohne_email(ctx):
    c, _, _, _ = ctx
    profil = c.get("/api/users/2/profile").json()
    assert set(profil) == {
        "id", "name", "username", "avatar_url", "bio",
        "follower_count", "following_count", "is_following", "preferences",
        "diet_labels", "exclusions", "pinned",
    }


# ── Cascade ──────────────────────────────────────────────────────────────────

def test_cascade_beim_user_delete(ctx):
    """Wird ein User geloescht, verschwinden seine Kanten in beide Richtungen."""
    c, db, als, _ = ctx
    c.post("/api/users/2/follow")          # ich → anna
    als("anna")
    c.post("/api/users/3/follow")          # anna → bob
    assert db.query(UserFollow).count() == 2

    db.execute(text("PRAGMA foreign_keys=ON"))
    db.execute(text("DELETE FROM users WHERE id = 2"))
    db.commit()
    assert db.query(UserFollow).count() == 0
