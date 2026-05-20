import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, subqueryload

from app.auth.dependencies import (
    get_current_user,
    get_optional_user,
    require_admin,
    require_chefkoch_or_above,
    require_koch_or_above,
)
from app.database import get_db
from app.models import Category, Ingredient, Recipe, RecipeStep, Tag, User, UserRole
from app.models.recipe import RecipeStatus
from app.recipes.schemas import (
    PaginatedRecipes,
    RecipeCreate,
    RecipeListItem,
    RecipeResponse,
    RecipeUpdate,
    StepIngredientResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(recipe_id: int, db: Session) -> Recipe:
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe


def _load_full(recipe_id: int, db: Session) -> Recipe:
    return (
        db.query(Recipe)
        .options(
            joinedload(Recipe.author),
            joinedload(Recipe.steps),
            joinedload(Recipe.ingredients),
            joinedload(Recipe.categories),
            joinedload(Recipe.tags),
            joinedload(Recipe.diet_labels),
            joinedload(Recipe.allergens),
            joinedload(Recipe.images),
        )
        .filter(Recipe.id == recipe_id)
        .first()
    )


def _resolve_categories(ids: list[int], db: Session) -> list[Category]:
    if not ids:
        return []
    return db.query(Category).filter(Category.id.in_(ids)).all()


def _resolve_tags(ids: list[int], db: Session) -> list[Tag]:
    if not ids:
        return []
    return db.query(Tag).filter(Tag.id.in_(ids)).all()


def _word_tokens(text: str) -> set[str]:
    return set(re.findall(r"\b\w+\b", text.lower()))


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedRecipes)
def list_recipes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: int | None = Query(None),
    tag: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    search_scope: str = Query("title"),
    author_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    from app.models.access import RecipeAccess

    q = db.query(Recipe).filter(Recipe.deleted_at.is_(None))

    now = datetime.now(timezone.utc)

    if current_user is None:
        # Unauthenticated: only active free_for_all recipes
        free_sq = (
            db.query(RecipeAccess.recipe_id)
            .filter(
                RecipeAccess.access_type == "free_for_all",
                RecipeAccess.declined_at.is_(None),
                or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
            )
            .subquery()
        )
        q = q.filter(Recipe.id.in_(free_sq))

    elif current_user.role in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin):
        # Küchenchef + Chefkoch sees everything
        if status_filter is not None:
            try:
                q = q.filter(Recipe.status == RecipeStatus(status_filter))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status '{status_filter}'")

    else:
        # Koch / Küchenhilfe: own + free_for_all + individual access
        free_sq = (
            db.query(RecipeAccess.recipe_id)
            .filter(
                RecipeAccess.access_type == "free_for_all",
                RecipeAccess.declined_at.is_(None),
                or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
            )
            .subquery()
        )
        individual_sq = (
            db.query(RecipeAccess.recipe_id)
            .filter(
                RecipeAccess.email == current_user.email,
                RecipeAccess.declined_at.is_(None),
                or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
            )
            .subquery()
        )
        visible = (
            (Recipe.created_by == current_user.id)
            | Recipe.id.in_(free_sq)
            | Recipe.id.in_(individual_sq)
        )
        if status_filter is not None:
            try:
                sf = RecipeStatus(status_filter)
                q = q.filter(visible & (Recipe.status == sf))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status '{status_filter}'")
        else:
            q = q.filter(visible)

    if category is not None:
        q = q.filter(Recipe.categories.any(Category.id == category))

    if tag is not None:
        q = q.filter(Recipe.tags.any(Tag.id == tag))

    if search:
        term = f"%{search}%"
        if "ingredients" in search_scope:
            q = q.filter(
                Recipe.title.ilike(term)
                | Recipe.description.ilike(term)
                | Recipe.ingredients.any(Ingredient.name.ilike(term))
            )
        elif "description" in search_scope:
            q = q.filter(Recipe.title.ilike(term) | Recipe.description.ilike(term))
        else:
            q = q.filter(Recipe.title.ilike(term))

    if author_id is not None:
        q = q.filter(Recipe.created_by == author_id)

    total = q.count()
    items = (
        q.options(
            subqueryload(Recipe.categories),
            subqueryload(Recipe.tags),
            joinedload(Recipe.author),
        )
        .order_by(Recipe.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedRecipes(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, (total + page_size - 1) // page_size),
    )


# ── Trash (must be before /{recipe_id}) ───────────────────────────────────────

@router.get("/trash", response_model=list[RecipeListItem])
def list_trash(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_chefkoch_or_above),
):
    return (
        db.query(Recipe)
        .options(
            subqueryload(Recipe.categories),
            subqueryload(Recipe.tags),
            joinedload(Recipe.author),
        )
        .filter(Recipe.deleted_at.isnot(None))
        .order_by(Recipe.deleted_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )


# ── Single ────────────────────────────────────────────────────────────────────

@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(
    recipe_id: int,
    token: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    from app.models.access import RecipeAccess
    from app.recipes.schemas import RecipeResponse as RecipeResponseSchema

    recipe = _load_full(recipe_id, db)
    if not recipe or recipe.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    now = datetime.now(timezone.utc)

    if current_user is None:
        # Unauthenticated: check free_for_all or individual token
        has_free = (
            db.query(RecipeAccess)
            .filter(
                RecipeAccess.recipe_id == recipe_id,
                RecipeAccess.access_type == "free_for_all",
                RecipeAccess.declined_at.is_(None),
                or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
            )
            .first()
        )
        if not has_free:
            if token:
                individual = (
                    db.query(RecipeAccess)
                    .filter(
                        RecipeAccess.recipe_id == recipe_id,
                        RecipeAccess.token == token,
                        RecipeAccess.declined_at.is_(None),
                        or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
                    )
                    .first()
                )
                if not individual:
                    raise HTTPException(status_code=404, detail="Recipe not found")
            else:
                raise HTTPException(status_code=404, detail="Recipe not found")
    elif current_user.role in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin):
        pass  # kuechenchef + chefkoch sees everything

    else:
        # Koch / Küchenhilfe: own OR free_for_all OR individual access
        if recipe.created_by != current_user.id:
            has_access = (
                db.query(RecipeAccess)
                .filter(
                    RecipeAccess.recipe_id == recipe_id,
                    or_(
                        RecipeAccess.access_type == "free_for_all",
                        RecipeAccess.email == current_user.email,
                    ),
                    RecipeAccess.declined_at.is_(None),
                    or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
                )
                .first()
            )
            if not has_access:
                raise HTTPException(status_code=404, detail="Recipe not found")

    # Check if current user has pending-review access (recipient sees review flag)
    if current_user and current_user.email:
        pending_access = (
            db.query(RecipeAccess)
            .filter(
                RecipeAccess.recipe_id == recipe_id,
                RecipeAccess.email == current_user.email,
                RecipeAccess.is_pending_review.is_(True),
            )
            .first()
        )
        if pending_access:
            return RecipeResponseSchema.model_validate(recipe).model_copy(
                update={"is_pending_review": True}
            )

    return recipe


# ── Step ingredients ──────────────────────────────────────────────────────────

@router.get("/{recipe_id}/steps/{step_id}/ingredients", response_model=list[StepIngredientResponse])
def get_step_ingredients(
    recipe_id: int,
    step_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if recipe.status != RecipeStatus.published and current_user is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    step = (
        db.query(RecipeStep)
        .filter(RecipeStep.id == step_id, RecipeStep.recipe_id == recipe_id)
        .first()
    )
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    all_ingredients = (
        db.query(Ingredient).filter(Ingredient.recipe_id == recipe_id).all()
    )

    if step.ingredient_ids is not None:
        # Manual assignment: return exactly the specified ingredients
        id_set = set(step.ingredient_ids)
        return [
            StepIngredientResponse(
                id=ing.id,
                name=ing.name,
                amount=ing.amount,
                unit=ing.unit,
                component_label=ing.component_label,
                auto_detected=False,
            )
            for ing in all_ingredients
            if ing.id in id_set
        ]

    # Auto-detection: all words of the ingredient name must appear in the instruction
    instr_tokens = _word_tokens(step.instruction)
    result = []
    for ing in all_ingredients:
        ing_tokens = _word_tokens(ing.name)
        if ing_tokens and ing_tokens.issubset(instr_tokens):
            result.append(
                StepIngredientResponse(
                    id=ing.id,
                    name=ing.name,
                    amount=ing.amount,
                    unit=ing.unit,
                    component_label=ing.component_label,
                    auto_detected=True,
                )
            )
    return result


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(
    body: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    recipe = Recipe(
        title=body.title,
        description=body.description,
        prep_time=body.prep_time,
        cook_time=body.cook_time,
        servings=body.servings,
        difficulty=body.difficulty,
        status=body.status,
        source=body.source,
        created_by=current_user.id,
    )
    db.add(recipe)
    db.flush()

    for step in body.steps:
        db.add(RecipeStep(**step.model_dump(), recipe_id=recipe.id))

    for ing in body.ingredients:
        db.add(Ingredient(**ing.model_dump(), recipe_id=recipe.id))

    recipe.categories = _resolve_categories(body.category_ids, db)
    recipe.tags = _resolve_tags(body.tag_ids, db)

    db.commit()
    return _load_full(recipe.id, db)


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: int,
    body: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = _load_full(recipe_id, db)
    if not recipe or recipe.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    from app.versioning import _recipe_snapshot, save_version

    is_author = (
        recipe.author_id == current_user.id or recipe.created_by == current_user.id
    )
    if (
        current_user.role not in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin)
        and not is_author
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Zugriff verweigert")

    # Capture snapshot before applying changes
    old_snapshot = _recipe_snapshot(recipe)

    scalar_fields = {"title", "description", "prep_time", "cook_time", "servings", "difficulty", "status", "source"}
    for field in body.model_fields_set & scalar_fields:
        setattr(recipe, field, getattr(body, field))

    if body.category_ids is not None:
        recipe.categories = _resolve_categories(body.category_ids, db)

    if body.tag_ids is not None:
        recipe.tags = _resolve_tags(body.tag_ids, db)

    if body.ingredients is not None:
        recipe.ingredients = [Ingredient(**ing.model_dump()) for ing in body.ingredients]

    if body.steps is not None:
        existing = {s.id: s for s in recipe.steps}
        new_steps = []
        for step_data in body.steps:
            d = step_data.model_dump()
            step_id = d.pop("id", None)
            if step_id and step_id in existing:
                s = existing[step_id]
                for k, v in d.items():
                    setattr(s, k, v)
                new_steps.append(s)
            else:
                new_steps.append(RecipeStep(**d, recipe_id=recipe.id))
        new_ids = {s.id for s in new_steps if s.id}
        for old_id, old_step in existing.items():
            if old_id not in new_ids:
                db.delete(old_step)
        recipe.steps = new_steps

    db.flush()
    save_version(recipe, old_snapshot, current_user.id, db)
    db.commit()
    return _load_full(recipe_id, db)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{recipe_id}")
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = _get_or_404(recipe_id, db)
    is_admin = current_user.role in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin)
    is_author = recipe.author_id == current_user.id or recipe.created_by == current_user.id
    if not is_admin and not is_author:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    recipe.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"detail": "Rezept wurde in den Papierkorb verschoben"}


# ── Status toggle ─────────────────────────────────────────────────────────────

@router.patch("/{recipe_id}/status", response_model=RecipeResponse)
def toggle_status(
    recipe_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    recipe = _get_or_404(recipe_id, db)
    recipe.status = (
        RecipeStatus.published
        if recipe.status == RecipeStatus.draft
        else RecipeStatus.draft
    )
    db.commit()
    return _load_full(recipe_id, db)


# ── Restore / Permanent delete ────────────────────────────────────────────────

@router.post("/{recipe_id}/restore")
def restore_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_chefkoch_or_above),
):
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id, Recipe.deleted_at.isnot(None)
    ).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht im Papierkorb")
    recipe.deleted_at = None
    db.commit()
    return {"detail": "Rezept wiederhergestellt"}


@router.delete("/{recipe_id}/permanent")
def delete_recipe_permanent(
    recipe_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_chefkoch_or_above),
):
    from app.models.media import Media
    from app.storage import storage

    recipe = (
        db.query(Recipe)
        .options(
            joinedload(Recipe.steps),
            joinedload(Recipe.images),
            joinedload(Recipe.videos),
        )
        .filter(Recipe.id == recipe_id, Recipe.deleted_at.isnot(None))
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht im Papierkorb")

    step_ids = [s.id for s in recipe.steps]
    conditions = [(Media.entity_type == "recipe") & (Media.entity_id == recipe_id)]
    if step_ids:
        conditions.append((Media.entity_type == "step") & Media.entity_id.in_(step_ids))
    media_records = db.query(Media).filter(or_(*conditions)).all()

    for m in media_records:
        if m.storage_path:
            storage.delete_file(m.storage_path)
        if m.thumbnail_path:
            storage.delete_file(m.thumbnail_path)
        db.delete(m)

    for img in recipe.images:
        if img.file_path:
            storage.delete_file(img.file_path)
    for vid in recipe.videos:
        if vid.file_path:
            storage.delete_file(vid.file_path)

    db.delete(recipe)
    db.commit()
    return {"detail": "Rezept endgültig gelöscht"}


# ── Ingredient suggestions ────────────────────────────────────────────────────

@router.get("/ingredients/suggestions", response_model=list[str])
def ingredient_suggestions(
    search: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        db.query(Ingredient.name)
        .filter(Ingredient.name.ilike(f"%{search}%"))
        .group_by(Ingredient.name)
        .order_by(func.count(Ingredient.name).desc(), Ingredient.name)
        .limit(10)
        .all()
    )
    return [r.name for r in rows]
