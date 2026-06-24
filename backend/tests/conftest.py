"""Conftest for unit tests.

Sets up environment variables and mocks the DB engine creation so the app modules
can be imported without a real PostgreSQL connection or psycopg2 installed locally.
These tests use a mocked Session — no real DB is touched.
"""
import os
import sys
from types import ModuleType
from unittest.mock import MagicMock, patch

# Required before any app module is imported.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/testdb")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")

# Stub psycopg2 so SQLAlchemy does not fail to load the dialect.
_psycopg2_stub = ModuleType("psycopg2")
_psycopg2_stub.extensions = MagicMock()
_psycopg2_stub.extras = MagicMock()
sys.modules.setdefault("psycopg2", _psycopg2_stub)
sys.modules.setdefault("psycopg2.extensions", MagicMock())
sys.modules.setdefault("psycopg2.extras", MagicMock())

# Prevent create_engine from actually connecting.
patch("sqlalchemy.create_engine", return_value=MagicMock()).start()
