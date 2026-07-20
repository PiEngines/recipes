"""Echte SQLite-Session für Router-Tests.

Das globale `conftest.py` mockt `sqlalchemy.create_engine` und liefert eine
MagicMock-Session — für Endpoints, die tatsächlich Daten lesen und schreiben,
reicht das nicht. Hier entsteht deshalb eine echte In-Memory-DB.

Zwei Eigenheiten, die dafür nötig sind:

* `create_engine` wird aus `sqlalchemy.engine` importiert. Der conftest-Patch
  ersetzt nur den Namen im `sqlalchemy`-Namespace, nicht die Funktion selbst.
* Fünf Spalten nutzen Postgres-eigene Typen (ARRAY/JSONB), die SQLite nicht
  anlegen kann. Sie werden ausschließlich fürs `CREATE TABLE` auf `Text`
  herabgesetzt und sofort zurückgesetzt — die Prod-Modelle bleiben unverändert
  (gegen echtes Postgres verifiziert).
"""
from sqlalchemy import Text
from sqlalchemy.engine import create_engine  # bewusst nicht `from sqlalchemy import …`
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import ExternalPost, Recipe, RecipeStep, RecipeVersion, User

# Angelegt wird das komplette Schema, keine handgepflegte Auswahl: Endpoints
# laden über Relationen mehr Tabellen als auf den ersten Blick sichtbar (der
# Rezept-Detail-Endpoint etwa Steps, Videos und Komponenten), und eine Teilmenge
# führt nur zu „no such table" an unerwarteter Stelle.
_PG_ONLY_COLUMNS = [
    Recipe.__table__.c.seasonal_tags,                # ARRAY
    ExternalPost.__table__.c.extracted_ingredients,  # JSONB
    RecipeVersion.__table__.c.snapshot,              # JSONB
    RecipeStep.__table__.c.ingredient_ids,           # JSONB
    RecipeStep.__table__.c.ingredient_ids_auto,      # JSONB
]


def make_session_factory():
    """Frische In-Memory-DB mit dem vollständigen Schema."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    originale = [(spalte, spalte.type) for spalte in _PG_ONLY_COLUMNS]
    for spalte, _ in originale:
        spalte.type = Text()
    try:
        Base.metadata.create_all(bind=engine)
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
