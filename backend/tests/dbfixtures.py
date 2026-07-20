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
from app.models import Ingredient, Recipe, ShoppingListItem, User
from app.models.access import RecipeAccess
from app.models.media import Media

_TABLES = [
    User.__table__,
    Recipe.__table__,
    Ingredient.__table__,
    ShoppingListItem.__table__,
    RecipeAccess.__table__,
    Media.__table__,
]


def make_session_factory():
    """Frische In-Memory-DB mit den für diese Tests nötigen Tabellen."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # `seasonal_tags` ist in Produktion ein Postgres-ARRAY, das SQLite nicht
    # anlegen kann. Der Typ wird nur für das CREATE TABLE herabgesetzt und
    # sofort wieder zurückgesetzt — die ORM-Metadaten bleiben damit über den
    # Testlauf hinweg unverändert ARRAY.
    spalte = Recipe.__table__.c.seasonal_tags
    original = spalte.type
    spalte.type = Text()
    try:
        Base.metadata.create_all(bind=engine, tables=_TABLES)
    finally:
        spalte.type = original

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
