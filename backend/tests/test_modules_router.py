"""Tests for the modules router endpoints and the module-resolution helper.

Uses FastAPI TestClient with dependency overrides so no real DB or JWT is needed.
The DB session is mocked via MagicMock; individual tests configure its return values.
"""
from decimal import Decimal
from fractions import Fraction
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.modules.router import router as modules_router
from app.recipes.schemas import RecipeResponse, IngredientResponse, RecipeStepResponse

# ── Test app setup ────────────────────────────────────────────────────────────

_test_app = FastAPI()
_test_app.include_router(modules_router)


def _make_user(user_id: int = 1, role="koch"):
    u = MagicMock()
    u.id = user_id
    u.email = f"user{user_id}@test.de"
    u.role = role
    return u


_DEFAULT_USER = _make_user()


def _override_db(mock_db):
    def _inner():
        return mock_db
    return _inner


def _override_user(user):
    def _inner():
        return user
    return _inner


def _make_client(mock_db=None, user=None):
    if mock_db is None:
        mock_db = MagicMock()
    if user is None:
        user = _DEFAULT_USER
    app = FastAPI()
    app.include_router(modules_router)
    app.dependency_overrides[get_db] = _override_db(mock_db)
    app.dependency_overrides[get_current_user] = _override_user(user)
    return TestClient(app)


# ── POST /{recipe_id}/components ──────────────────────────────────────────────

class TestAddComponent:
    def test_recipe_not_found_returns_404(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        client = _make_client(mock_db)

        resp = client.post("/api/recipes/99/components", json={"child_recipe_id": 2})
        assert resp.status_code == 404

    def test_wrong_owner_returns_403(self):
        mock_db = MagicMock()
        recipe = MagicMock()
        recipe.created_by = 999  # different user
        mock_db.query.return_value.filter.return_value.first.return_value = recipe
        client = _make_client(mock_db, user=_make_user(user_id=1))

        resp = client.post("/api/recipes/1/components", json={"child_recipe_id": 2})
        assert resp.status_code == 403

    def test_circular_reference_returns_400(self):
        mock_db = MagicMock()
        recipe = MagicMock()
        recipe.id = 1
        recipe.created_by = 1
        recipe.deleted_at = None
        mock_db.query.return_value.filter.return_value.first.return_value = recipe

        with patch("app.modules.router.embed_module") as mock_embed:
            from fastapi import HTTPException
            mock_embed.side_effect = HTTPException(status_code=400, detail="Zirkelreferenz")
            client = _make_client(mock_db, user=_make_user(user_id=1))
            resp = client.post("/api/recipes/1/components", json={"child_recipe_id": 1})

        assert resp.status_code == 400

    def test_successful_embed_returns_201(self):
        mock_db = MagicMock()
        recipe = MagicMock()
        recipe.id = 1
        recipe.created_by = 1
        recipe.deleted_at = None
        mock_db.query.return_value.filter.return_value.first.return_value = recipe

        component = MagicMock()
        component.parent_recipe_id = 1
        component.child_recipe_id = 2
        component.sort_order = 0
        component.flatten_into_parent = True
        component.servings_override = None
        component.scale_factor = None
        component.referenced_version_id = 5

        with patch("app.modules.router.embed_module", return_value=component):
            client = _make_client(mock_db, user=_make_user(user_id=1))
            resp = client.post("/api/recipes/1/components", json={"child_recipe_id": 2})

        assert resp.status_code == 201
        data = resp.json()
        assert data["parent_recipe_id"] == 1
        assert data["child_recipe_id"] == 2
        assert data["flatten_into_parent"] is True
        assert data["referenced_version_id"] == 5


# ── GET /{recipe_id}/used-in ──────────────────────────────────────────────────

class TestUsedIn:
    def test_returns_count_zero(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.scalar.return_value = 0
        client = _make_client(mock_db)

        resp = client.get("/api/recipes/1/used-in")
        assert resp.status_code == 200
        assert resp.json() == {"count": 0}

    def test_returns_correct_count(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.scalar.return_value = 3
        client = _make_client(mock_db)

        resp = client.get("/api/recipes/1/used-in")
        assert resp.status_code == 200
        assert resp.json() == {"count": 3}

    def test_no_auth_required(self):
        # used-in has no get_current_user dependency — override should not be needed
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.scalar.return_value = 7
        app = FastAPI()
        app.include_router(modules_router)
        app.dependency_overrides[get_db] = _override_db(mock_db)
        client = TestClient(app)

        resp = client.get("/api/recipes/42/used-in")
        assert resp.status_code == 200
        assert resp.json()["count"] == 7


# ── _build_module_response unit tests ────────────────────────────────────────

def _make_recipe(
    recipe_id: int = 1,
    title: str = "Hauptrezept",
    servings: int = 4,
    created_by: int = 1,
    ingredients=None,
    steps=None,
    child_components=None,
    author=None,
):
    """Build a minimal mock Recipe object."""
    r = MagicMock()
    r.id = recipe_id
    r.title = title
    r.servings = servings
    r.created_by = created_by
    r.description = None
    r.prep_time = None
    r.cook_time = None
    r.difficulty = None
    r.status = "published"
    r.type = "kochen"
    r.course = None
    r.source = None
    r.review_status = None
    r.thumbnail_style = "crop"
    r.created_by = created_by
    r.created_at = "2026-01-01T00:00:00"
    r.updated_at = "2026-01-01T00:00:00"
    r.categories = []
    r.tags = []
    r.diet_labels = []
    r.allergens = []
    r.is_pending_review = False
    r.module_authors = None
    author_mock = MagicMock()
    author_mock.id = created_by
    author_mock.name = "Chef"
    author_mock.username = "chef"
    r.author = author if author else author_mock
    r.ingredients = ingredients or []
    r.steps = steps or []
    r.child_components = child_components or []
    return r


def _make_component(
    parent_id: int,
    child_id: int,
    sort_order: int = 0,
    flatten: bool = True,
    servings_override=None,
    scale_factor=None,
    referenced_version_id=None,
):
    c = MagicMock()
    c.parent_recipe_id = parent_id
    c.child_recipe_id = child_id
    c.sort_order = sort_order
    c.flatten_into_parent = flatten
    c.servings_override = servings_override
    c.scale_factor = Decimal(str(scale_factor)) if scale_factor is not None else None
    c.referenced_version_id = referenced_version_id
    return c


class TestBuildModuleResponse:
    """Unit tests for the _build_module_response helper in recipes/router.py."""

    def _get_helper(self):
        from app.recipes.router import _build_module_response
        return _build_module_response

    def test_no_modules_returns_base_response(self):
        build = self._get_helper()
        recipe = _make_recipe(child_components=[])
        mock_db = MagicMock()

        # A recipe without components should still resolve (no flat components found)
        # In practice this branch is guarded by the caller, but the helper still works.
        result = build(recipe, mock_db, is_pending_review=False)
        assert isinstance(result, RecipeResponse)
        assert result.title == "Hauptrezept"

    def test_module_ingredients_appended_with_scaled_amounts(self):
        build = self._get_helper()

        snap = {
            "title": "Sauce",
            "servings": 2,
            "ingredients": [
                {"id": 10, "name": "Tomaten", "amount": "1", "unit": "kg",
                 "component_label": None, "sort_order": 0},
            ],
            "steps": [],
        }
        version = MagicMock()
        version.snapshot = snap

        comp = _make_component(1, 2, referenced_version_id=99)

        mock_child = MagicMock()
        mock_child.created_by = 1  # same owner → no author attribution

        mock_db = MagicMock()
        mock_db.get.side_effect = lambda model, pk: version if pk == 99 else mock_child

        recipe = _make_recipe(recipe_id=1, servings=4, child_components=[comp])
        result = build(recipe, mock_db, is_pending_review=False)

        # parent has 4 servings, module has 2 → scale 1:2 → "2"
        assert any(
            ing.name == "Tomaten" and ing.amount == "2" and ing.component_label == "Sauce"
            for ing in result.ingredients
        )

    def test_module_steps_appended_with_prefix(self):
        build = self._get_helper()

        snap = {
            "title": "Teig",
            "servings": 4,
            "ingredients": [],
            "steps": [
                {"id": 20, "sort_order": 0, "title": None,
                 "instruction": "Mehl vermengen.", "timer_seconds": None},
                {"id": 21, "sort_order": 1, "title": None,
                 "instruction": "Kneten.", "timer_seconds": None},
            ],
        }
        version = MagicMock()
        version.snapshot = snap
        comp = _make_component(1, 2, referenced_version_id=77)
        mock_child = MagicMock()
        mock_child.created_by = 1

        mock_db = MagicMock()
        mock_db.get.side_effect = lambda model, pk: version if pk == 77 else mock_child

        recipe = _make_recipe(recipe_id=1, servings=4, child_components=[comp])
        result = build(recipe, mock_db, is_pending_review=False)

        module_steps = [s for s in result.steps if s.title and "Teig" in s.title]
        assert len(module_steps) == 2
        assert module_steps[0].title == "Teig: Schritt 1"
        assert module_steps[1].title == "Teig: Schritt 2"
        assert module_steps[0].instruction == "Mehl vermengen."

    def test_servings_override_applied(self):
        build = self._get_helper()

        snap = {
            "title": "Dressing",
            "servings": 4,
            "ingredients": [
                {"id": 30, "name": "Öl", "amount": "4", "unit": "EL",
                 "component_label": None, "sort_order": 0},
            ],
            "steps": [],
        }
        version = MagicMock()
        version.snapshot = snap
        # override: treat as 2 portions instead of parent's 4
        comp = _make_component(1, 2, referenced_version_id=55, servings_override=2)
        mock_child = MagicMock()
        mock_child.created_by = 1

        mock_db = MagicMock()
        mock_db.get.side_effect = lambda model, pk: version if pk == 55 else mock_child

        recipe = _make_recipe(recipe_id=1, servings=8, child_components=[comp])
        result = build(recipe, mock_db, is_pending_review=False)

        oil = next(i for i in result.ingredients if i.name == "Öl")
        # 4 * override(2) / module(4) = 2
        assert oil.amount == "2"

    def test_foreign_module_author_included(self):
        build = self._get_helper()

        snap = {"title": "Externe Sauce", "servings": 2, "ingredients": [], "steps": []}
        version = MagicMock()
        version.snapshot = snap
        comp = _make_component(1, 2, referenced_version_id=11)

        foreign_author = MagicMock()
        foreign_author.id = 99
        foreign_author.name = "Fremder Koch"
        foreign_author.username = "fremder"

        mock_child = MagicMock()
        mock_child.created_by = 99   # different from recipe.created_by (1)
        mock_child.author = foreign_author

        mock_db = MagicMock()
        mock_db.get.side_effect = lambda model, pk: version if pk == 11 else mock_child

        recipe = _make_recipe(recipe_id=1, servings=4, created_by=1, child_components=[comp])
        result = build(recipe, mock_db, is_pending_review=False)

        assert result.module_authors is not None
        assert any(a.id == 99 for a in result.module_authors)

    def test_unparsable_amount_passed_through_unchanged(self):
        build = self._get_helper()

        snap = {
            "title": "Gewürze",
            "servings": 4,
            "ingredients": [
                {"id": 40, "name": "Salz", "amount": "nach Geschmack", "unit": None,
                 "component_label": None, "sort_order": 0},
            ],
            "steps": [],
        }
        version = MagicMock()
        version.snapshot = snap
        comp = _make_component(1, 2, referenced_version_id=22)
        mock_child = MagicMock()
        mock_child.created_by = 1

        mock_db = MagicMock()
        mock_db.get.side_effect = lambda model, pk: version if pk == 22 else mock_child

        recipe = _make_recipe(recipe_id=1, servings=4, child_components=[comp])
        result = build(recipe, mock_db, is_pending_review=False)

        salz = next(i for i in result.ingredients if i.name == "Salz")
        assert salz.amount == "nach Geschmack"

    def test_fallback_to_live_recipe_when_version_is_none(self):
        build = self._get_helper()

        # referenced_version_id set but version not found → fall through to fallback path
        comp = _make_component(1, 2, referenced_version_id=999)

        live_ing = MagicMock()
        live_ing.id = 50
        live_ing.name = "Zucker"
        live_ing.amount = "2"
        live_ing.unit = "EL"
        live_ing.component_label = None
        live_ing.sort_order = 0
        live_ing.is_integer = False

        live_step = MagicMock()
        live_step.id = 60
        live_step.sort_order = 0
        live_step.title = None
        live_step.instruction = "Zucker schmelzen."
        live_step.timer_seconds = None

        live_author = MagicMock()
        live_author.id = 1
        live_author.name = "Chef"
        live_author.username = "chef"

        live_child = MagicMock()
        live_child.title = "Karamell"
        live_child.servings = 4
        live_child.created_by = 1
        live_child.author = live_author
        live_child.ingredients = [live_ing]
        live_child.steps = [live_step]

        mock_db = MagicMock()
        # get(RecipeVersion, 999) → None triggers fallback
        mock_db.get.return_value = None
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = live_child

        recipe = _make_recipe(recipe_id=1, servings=4, child_components=[comp])
        result = build(recipe, mock_db, is_pending_review=False)

        assert any(i.name == "Zucker" and i.component_label == "Karamell" for i in result.ingredients)
        assert any("Karamell" in (s.title or "") for s in result.steps)

    def test_is_pending_review_forwarded(self):
        build = self._get_helper()
        recipe = _make_recipe(child_components=[])
        mock_db = MagicMock()

        result = build(recipe, mock_db, is_pending_review=True)
        assert result.is_pending_review is True


# ── DELETE /{recipe_id}/components/{component_id} ────────────────────────────

class TestDeleteComponent:
    def test_success_returns_204(self):
        mock_db = MagicMock()
        recipe = MagicMock()
        recipe.id = 1
        recipe.created_by = 1
        recipe.deleted_at = None

        component = MagicMock()

        # First db.query().filter().first() → recipe, second → component
        mock_db.query.return_value.filter.return_value.first.side_effect = [recipe, component]
        client = _make_client(mock_db, user=_make_user(user_id=1))

        resp = client.delete("/api/recipes/1/components/2")
        assert resp.status_code == 204
        mock_db.delete.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_recipe_not_found_returns_404(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        client = _make_client(mock_db, user=_make_user(user_id=1))

        resp = client.delete("/api/recipes/99/components/2")
        assert resp.status_code == 404

    def test_wrong_owner_returns_403(self):
        mock_db = MagicMock()
        recipe = MagicMock()
        recipe.id = 1
        recipe.created_by = 999
        recipe.deleted_at = None
        mock_db.query.return_value.filter.return_value.first.return_value = recipe
        client = _make_client(mock_db, user=_make_user(user_id=1))

        resp = client.delete("/api/recipes/1/components/2")
        assert resp.status_code == 403


# ── POST /{recipe_id}/components/extract ─────────────────────────────────────

class TestExtractComponent:
    def test_success_returns_201(self):
        mock_db = MagicMock()

        parent = MagicMock()
        parent.id = 1
        parent.created_by = 1
        parent.deleted_at = None
        parent.type = "kochen"

        ing = MagicMock()
        ing.name = "Mehl"
        ing.amount = "200"
        ing.unit = "g"
        ing.sort_order = 0
        ing.is_integer = False

        new_recipe = MagicMock()
        new_recipe.id = 42
        new_recipe.title = "Teig Modul"

        query_recipe = MagicMock()
        query_recipe.filter.return_value.first.return_value = parent
        query_ing = MagicMock()
        query_ing.filter.return_value.order_by.return_value.all.return_value = [ing]
        mock_db.query.side_effect = [query_recipe, query_ing]

        with patch("app.modules.router.Recipe", return_value=new_recipe):
            with patch("app.modules.router.embed_module") as mock_embed:
                client = _make_client(mock_db, user=_make_user(user_id=1))
                resp = client.post("/api/recipes/1/components/extract", json={
                    "component_label": "Teig",
                    "new_recipe_title": "Teig Modul",
                })

        assert resp.status_code == 201
        data = resp.json()
        assert data["new_recipe_id"] == 42
        assert data["new_recipe_title"] == "Teig Modul"
        assert data["component_id"] == 42
        mock_embed.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_group_not_found_returns_404(self):
        mock_db = MagicMock()

        parent = MagicMock()
        parent.id = 1
        parent.created_by = 1
        parent.deleted_at = None

        query_recipe = MagicMock()
        query_recipe.filter.return_value.first.return_value = parent
        query_ing = MagicMock()
        query_ing.filter.return_value.order_by.return_value.all.return_value = []
        mock_db.query.side_effect = [query_recipe, query_ing]

        client = _make_client(mock_db, user=_make_user(user_id=1))
        resp = client.post("/api/recipes/1/components/extract", json={
            "component_label": "NichtVorhanden",
            "new_recipe_title": "Test",
        })

        assert resp.status_code == 404

    def test_wrong_owner_returns_403(self):
        mock_db = MagicMock()

        parent = MagicMock()
        parent.id = 1
        parent.created_by = 999
        parent.deleted_at = None

        query_recipe = MagicMock()
        query_recipe.filter.return_value.first.return_value = parent
        mock_db.query.return_value = query_recipe

        client = _make_client(mock_db, user=_make_user(user_id=1))
        resp = client.post("/api/recipes/1/components/extract", json={
            "component_label": "Teig",
            "new_recipe_title": "Test",
        })

        assert resp.status_code == 403

    def test_db_error_triggers_rollback_and_returns_500(self):
        mock_db = MagicMock()

        parent = MagicMock()
        parent.id = 1
        parent.created_by = 1
        parent.deleted_at = None
        parent.type = "kochen"

        ing = MagicMock()
        ing.name = "Mehl"
        ing.amount = "200"
        ing.unit = "g"
        ing.sort_order = 0
        ing.is_integer = False

        new_recipe = MagicMock()
        new_recipe.id = 42
        new_recipe.title = "Teig"

        query_recipe = MagicMock()
        query_recipe.filter.return_value.first.return_value = parent
        query_ing = MagicMock()
        query_ing.filter.return_value.order_by.return_value.all.return_value = [ing]
        mock_db.query.side_effect = [query_recipe, query_ing]

        with patch("app.modules.router.Recipe", return_value=new_recipe):
            with patch("app.modules.router.embed_module", side_effect=Exception("DB exploded")):
                client = _make_client(mock_db, user=_make_user(user_id=1))
                resp = client.post("/api/recipes/1/components/extract", json={
                    "component_label": "Teig",
                    "new_recipe_title": "Teig",
                })

        assert resp.status_code == 500
        mock_db.rollback.assert_called_once()
        mock_db.commit.assert_not_called()


# ── GET / as_module – parameter acceptance ────────────────────────────────────

class TestListRecipesAsModule:
    """Smoke-test that as_module parameter is accepted and forwarded correctly.

    Full query-filtering correctness requires integration tests with a real DB.
    These tests verify the endpoint doesn't error and returns a valid response shape.
    """

    def _make_search_client(self, mock_db=None, user=None):
        from app.recipes.router import router as recipes_router
        from app.auth.dependencies import get_current_user

        if mock_db is None:
            mock_db = MagicMock()
        if user is None:
            user = _make_user()

        # Configure mock DB to return an empty paginated result
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.options.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        # The list_recipes function also does db.query(RecipeAccess.recipe_id).filter(...)
        mock_db.query.return_value = mock_query

        app = FastAPI()
        app.include_router(recipes_router)
        app.dependency_overrides[get_db] = _override_db(mock_db)
        app.dependency_overrides[get_current_user] = _override_user(user)
        return TestClient(app)

    def test_as_module_false_accepted(self):
        client = self._make_search_client()
        resp = client.get("/api/recipes?as_module=false")
        assert resp.status_code == 200

    def test_as_module_true_accepted_for_auth_user(self):
        from app.models.user import UserRole
        user = _make_user()
        user.role = UserRole.admin
        user.email = "admin@test.de"
        client = self._make_search_client(user=user)
        resp = client.get("/api/recipes?as_module=true")
        assert resp.status_code == 200

    def test_response_is_paginated(self):
        client = self._make_search_client()
        resp = client.get("/api/recipes?as_module=false")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 0
