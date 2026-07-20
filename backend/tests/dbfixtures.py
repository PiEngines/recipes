"""Echte SQLite-Session für Router-Tests (Shopping/Bring).

Das globale `conftest.py` mockt `sqlalchemy.create_engine` und liefert eine
MagicMock-Session — für Endpoints, die tatsächlich Daten lesen und schreiben,
reicht das nicht. Hier entsteht deshalb eine echte In-Memory-DB.

Zwei Eigenheiten, die dafür nötig sind:

* `create_engine` wird aus `sqlalchemy.engine` importiert. Der conftest-Patch
  ersetzt nur den Namen im `sqlalchemy`-Namespace, nicht die Funktion selbst.
* `recipes.seasonal_tags` ist in Produktion ein Postgres-`ARRAY`, das SQLite
  nicht anlegen kann. Der Typ wird ausschließlich für die Testtabelle auf
  `Text` gesetzt — das Prod-Modell bleibt unverändert `ARRAY`.
"""
from sqlalchemy import Text
from sqlalchemy.engine import create_engine  # bewusst nicht `from sqlalchemy import …`
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    ExternalPost,
    Ingredient,
    Recipe,
    ShoppingListItem,
    User,
    UserFollow,
)
from app.models.access import RecipeAccess
from app.models.media import Media

_TABLES = [
    User.__table__,
    Recipe.__table__,
    Ingredient.__table__,
    ShoppingListItem.__table__,
    RecipeAccess.__table__,
    Media.__table__,
    UserFollow.__table__,
    ExternalPost.__table__,
]

# Postgres-eigene Spaltentypen, die SQLite nicht anlegen kann. Sie werden nur
# für das CREATE TABLE herabgesetzt und danach zurückgesetzt — die ORM-Modelle
# bleiben in Produktion unverändert (gegen echtes Postgres verifiziert).
_PG_ONLY_COLUMNS = [
    Recipe.__table__.c.seasonal_tags,          # ARRAY
    ExternalPost.__table__.c.extracted_ingredients,  # JSONB
]


def make_session_factory():
    """Frische In-Memory-DB mit den für diese Tests nötigen Tabellen."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    originale = [(spalte, spalte.type) for spalte in _PG_ONLY_COLUMNS]
    for spalte, _ in originale:
        spalte.type = Text()
    try:
        Base.metadata.create_all(bind=engine, tables=_TABLES)
    finally:
        for spalte, typ in originale:
            spalte.type = typ

    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def make_user(db, user_id, username, role, email=None):
    from app.models.user import UserRole

    user = User(
        id=user_id,
        name=username.capitalize(),
        email=email or f"{username}@test.de",
        username=username,
        password_hash="x",
        role=role if isinstance(role, UserRole) else UserRole(role),
    )
    db.add(user)
    return user
