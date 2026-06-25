import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
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
from app.matching import step_scanner
from app.models import Category, Ingredient, Recipe, RecipeComponent, RecipeStep, RecipeVersion, Tag, User, UserRole
from app.models.recipe import RecipeType
from app.utils.scaling import scale_amount
from app.models.step_suggestion import StepUnmatchedSuggestion
from app.recipes import matching
from app.recipes.schemas import (
    AuthorResponse,
    ComponentEmbedInfo,
    IngredientResponse,
    PaginatedRecipes,
    RecipeCreate,
    RecipeListItem,
    RecipeResponse,
    RecipeStepResponse,
    RecipeUpdate,
    RematchResponse,
    StepIngredientIdsUpdate,
    StepIngredientResponse,
    StepIngredientsResponse,
    StepSuggestionAccept,
    StepSuggestionGroup,
    StepSuggestionItem,
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


# TODO: deprecated, replaced by matching.py
def _word_tokens(text: str) -> set[str]:
    return set(re.findall(r"\b\w+\b", text.lower()))


def _apply_visibility_filter(q, current_user: User | None, db: Session):
    from app.models.access import RecipeAccess

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
        return q.filter(Recipe.id.in_(free_sq))

    if current_user.role in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin):
        # Küchenchef + Chefkoch sees everything
        return q

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
    return q.filter(visible)


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedRecipes)
def list_recipes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: int | None = Query(None),
    tag: int | None = Query(None),
    search: str | None = Query(None),
    search_scope: str = Query("title"),
    author_id: int | None = Query(None),
    author: str | None = Query(None),
    type: str | None = Query(None),
    as_module: bool = Query(False),
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
        pass  # Küchenchef + Chefkoch sees everything

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
        q = q.filter(visible)

    # When browsing for embeddable modules, restrict every authenticated user to
    # own recipes + recipes shared with them — regardless of their role.
    if as_module and current_user is not None:
        free_sq_m = (
            db.query(RecipeAccess.recipe_id)
            .filter(
                RecipeAccess.access_type == "free_for_all",
                RecipeAccess.declined_at.is_(None),
                or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
            )
            .subquery()
        )
        individual_sq_m = (
            db.query(RecipeAccess.recipe_id)
            .filter(
                RecipeAccess.email == current_user.email,
                RecipeAccess.declined_at.is_(None),
                or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
            )
            .subquery()
        )
        q = q.filter(
            (Recipe.created_by == current_user.id)
            | Recipe.id.in_(free_sq_m)
            | Recipe.id.in_(individual_sq_m)
        )

    if type is not None:
        try:
            q = q.filter(Recipe.type == RecipeType(type).value)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid type '{type}'")

    if category is not None:
        q = q.filter(Recipe.categories.any(Category.id == category))

    if tag is not None:
        q = q.filter(Recipe.tags.any(Tag.id == tag))

    if search:
        term = f"%{search}%"
        conditions = [Recipe.title.ilike(term)]
        if "description" in search_scope:
            conditions.append(Recipe.description.ilike(term))
        if "ingredients" in search_scope:
            conditions.append(Recipe.ingredients.any(Ingredient.name.ilike(term)))
        if "steps" in search_scope:
            conditions.append(Recipe.steps.any(RecipeStep.instruction.ilike(term)))
        q = q.filter(or_(*conditions))

    if author_id is not None:
        q = q.filter(Recipe.created_by == author_id)

    if author:
        term = f"%{author}%"
        q = q.join(User, Recipe.created_by == User.id).filter(
            User.username.ilike(term) | User.email.ilike(term)
        )

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


# ── Random (must be before /{recipe_id}) ──────────────────────────────────────

@router.get("/random", response_model=list[RecipeListItem])
def get_random_recipes(
    count: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    q = db.query(Recipe).filter(Recipe.deleted_at.is_(None))
    q = _apply_visibility_filter(q, current_user, db)

    return (
        q.options(
            subqueryload(Recipe.categories),
            subqueryload(Recipe.tags),
            joinedload(Recipe.author),
        )
        .order_by(func.random())
        .limit(count)
        .all()
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


# ── Module resolution ─────────────────────────────────────────────────────────

def _build_module_response(
    recipe: Recipe,
    db: Session,
    is_pending_review: bool,
) -> RecipeResponse:
    """Merge flat-module ingredients and steps into the parent recipe's response."""
    flat_components = sorted(
        [c for c in recipe.child_components if c.flatten_into_parent],
        key=lambda c: c.sort_order,
    )

    base = RecipeResponse.model_validate(recipe)
    if is_pending_review:
        base = base.model_copy(update={"is_pending_review": True})

    extra_ingredients: list[IngredientResponse] = []
    extra_steps: list[RecipeStepResponse] = []
    embed_infos: list[ComponentEmbedInfo] = []
    module_author_map: dict[int, AuthorResponse] = {}
    next_step_sort = max((s.sort_order for s in base.steps), default=0) + 1

    for comp in flat_components:
        module_title: str | None = None
        module_servings: int | None = None
        raw_ingredients: list[dict] = []
        raw_steps: list[dict] = []
        module_created_by: int | None = None
        module_author_obj = None

        if comp.referenced_version_id is not None:
            version = db.get(RecipeVersion, comp.referenced_version_id)
            if version:
                snap = version.snapshot
                module_title = snap.get("title", "Modul")
                module_servings = snap.get("servings")
                raw_ingredients = snap.get("ingredients", [])
                raw_steps = snap.get("steps", [])
                # Author info comes from the live child (created_by doesn't change)
                child_for_author = db.get(Recipe, comp.child_recipe_id)
                if child_for_author:
                    module_created_by = child_for_author.created_by
                    if child_for_author.created_by != recipe.created_by:
                        module_author_obj = child_for_author.author

        if module_title is None:
            # Fallback: live child recipe
            child = (
                db.query(Recipe)
                .options(
                    joinedload(Recipe.author),
                    joinedload(Recipe.ingredients),
                    joinedload(Recipe.steps),
                )
                .filter(Recipe.id == comp.child_recipe_id)
                .first()
            )
            if child is None:
                continue
            module_title = child.title
            module_servings = child.servings
            module_created_by = child.created_by
            raw_ingredients = [
                {
                    "id": i.id, "name": i.name, "amount": i.amount,
                    "unit": i.unit, "component_label": i.component_label,
                    "sort_order": i.sort_order, "is_integer": i.is_integer,
                }
                for i in sorted(child.ingredients, key=lambda x: x.sort_order)
            ]
            raw_steps = [
                {
                    "id": s.id, "sort_order": s.sort_order, "title": s.title,
                    "instruction": s.instruction, "timer_seconds": s.timer_seconds,
                }
                for s in sorted(child.steps, key=lambda x: x.sort_order)
            ]
            if child.created_by != recipe.created_by and child.author:
                module_author_obj = child.author

        if module_author_obj and module_created_by and module_created_by not in module_author_map:
            module_author_map[module_created_by] = AuthorResponse.model_validate(module_author_obj)

        embed_infos.append(ComponentEmbedInfo(
            id=comp.child_recipe_id,
            child_recipe_id=comp.child_recipe_id,
            child_recipe_title=module_title,
            sort_order=comp.sort_order,
            servings_override=comp.servings_override,
            scale_factor=float(comp.scale_factor) if comp.scale_factor is not None else None,
        ))

        parent_servings = recipe.servings or 1
        module_servings_eff = module_servings or 1
        sf = float(comp.scale_factor) if comp.scale_factor is not None else None

        for ing in raw_ingredients:
            amount = ing.get("amount")
            if amount:
                amount = scale_amount(
                    amount,
                    module_servings=module_servings_eff,
                    parent_servings=parent_servings,
                    servings_override=comp.servings_override,
                    scale_factor=sf,
                )
            extra_ingredients.append(
                IngredientResponse(
                    id=ing["id"],
                    name=ing["name"],
                    amount=amount,
                    unit=ing.get("unit"),
                    component_label=ing.get("component_label") or module_title,
                    sort_order=ing.get("sort_order", 0),
                    is_integer=ing.get("is_integer", False),
                )
            )

        for n, step in enumerate(
            sorted(raw_steps, key=lambda s: s.get("sort_order", 0)), start=1
        ):
            extra_steps.append(
                RecipeStepResponse(
                    id=step["id"],
                    sort_order=next_step_sort,
                    title=f"{module_title}: Schritt {n}",
                    instruction=step["instruction"],
                    timer_seconds=step.get("timer_seconds"),
                    timer_label=None,
                    image_path=None,
                    video_path=None,
                    ingredient_ids=None,
                    is_module_step=True,
                )
            )
            next_step_sort += 1

    return base.model_copy(update={
        "ingredients": list(base.ingredients) + extra_ingredients,
        "steps": list(base.steps) + extra_steps,
        "module_authors": list(module_author_map.values()) or None,
        "components": embed_infos,
    })


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
    is_pending_review = False
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
            is_pending_review = True

    # Resolve flat modules if any — recipes without modules behave exactly as before.
    flat_components = [c for c in recipe.child_components if c.flatten_into_parent]
    if flat_components:
        return _build_module_response(recipe, db, is_pending_review)

    if is_pending_review:
        return RecipeResponseSchema.model_validate(recipe).model_copy(
            update={"is_pending_review": True}
        )
    return recipe


# ── Step ingredients ──────────────────────────────────────────────────────────

@router.get("/{recipe_id}/steps/{step_id}/ingredients", response_model=StepIngredientsResponse)
def get_step_ingredients(
    recipe_id: int,
    step_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if current_user is None:
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

    suspicious_tokens = matching.get_suspicious_tokens(step.instruction, all_ingredients)

    # Priority: manual override -> system-suggested auto match -> live matching
    if step.ingredient_ids is not None:
        id_set = set(step.ingredient_ids)
        auto_detected = False
    elif step.ingredient_ids_auto is not None:
        id_set = set(step.ingredient_ids_auto)
        auto_detected = True
    else:
        id_set = set(matching.match_ingredients(step.instruction, all_ingredients))
        auto_detected = True

    ingredients = [
        StepIngredientResponse(
            id=ing.id,
            name=ing.name,
            amount=ing.amount,
            unit=ing.unit,
            component_label=ing.component_label,
            auto_detected=auto_detected,
        )
        for ing in all_ingredients
        if ing.id in id_set
    ]

    return StepIngredientsResponse(ingredients=ingredients, suspicious_tokens=suspicious_tokens)


# ── Rematch ───────────────────────────────────────────────────────────────────

@router.post("/{recipe_id}/rematch", response_model=RematchResponse)
def rematch_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    all_ingredients = db.query(Ingredient).filter(Ingredient.recipe_id == recipe_id).all()
    steps = db.query(RecipeStep).filter(RecipeStep.recipe_id == recipe_id).all()

    for step in steps:
        step.ingredient_ids_auto = matching.match_ingredients(step.instruction, all_ingredients)

    recipe.matching_reviewed_at = None
    db.commit()

    return RematchResponse(steps_updated=len(steps))


# ── Ingredient matching review flow ────────────────────────────────────────────

def _require_author_or_chef(recipe: Recipe, current_user: User) -> None:
    is_author = recipe.author_id == current_user.id or recipe.created_by == current_user.id
    if current_user.role not in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin) and not is_author:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Zugriff verweigert")


@router.patch("/{recipe_id}/steps/{step_id}/ingredients")
def update_step_ingredients(
    recipe_id: int,
    step_id: int,
    body: StepIngredientIdsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = _get_or_404(recipe_id, db)
    _require_author_or_chef(recipe, current_user)

    step = (
        db.query(RecipeStep)
        .filter(RecipeStep.id == step_id, RecipeStep.recipe_id == recipe_id)
        .first()
    )
    if not step:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Step not found")

    valid_ids = {
        ing_id for (ing_id,) in db.query(Ingredient.id).filter(Ingredient.recipe_id == recipe_id)
    }
    step.ingredient_ids = [i for i in body.ingredient_ids if i in valid_ids]
    db.commit()
    return {"ok": True}


@router.post("/{recipe_id}/matching-review")
def complete_matching_review(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = _get_or_404(recipe_id, db)
    _require_author_or_chef(recipe, current_user)

    recipe.matching_reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# ── Step suggestions (unmatched-token review) ──────────────────────────────────

@router.get("/{recipe_id}/step-suggestions", response_model=list[StepSuggestionGroup])
def get_step_suggestions(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = _get_or_404(recipe_id, db)
    _require_author_or_chef(recipe, current_user)

    rows = (
        db.query(StepUnmatchedSuggestion)
        .filter(
            StepUnmatchedSuggestion.recipe_id == recipe_id,
            StepUnmatchedSuggestion.status == "open",
        )
        .order_by(StepUnmatchedSuggestion.step_id, StepUnmatchedSuggestion.id)
        .all()
    )

    grouped: dict[int, list[StepSuggestionItem]] = {}
    for row in rows:
        grouped.setdefault(row.step_id, []).append(StepSuggestionItem.model_validate(row))

    return [
        StepSuggestionGroup(step_id=step_id, suggestions=items)
        for step_id, items in grouped.items()
    ]


@router.post("/{recipe_id}/step-suggestions/{suggestion_id}/accept", response_model=IngredientResponse)
def accept_step_suggestion(
    recipe_id: int,
    suggestion_id: int,
    body: StepSuggestionAccept,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = _get_or_404(recipe_id, db)
    _require_author_or_chef(recipe, current_user)

    suggestion = (
        db.query(StepUnmatchedSuggestion)
        .filter(
            StepUnmatchedSuggestion.id == suggestion_id,
            StepUnmatchedSuggestion.recipe_id == recipe_id,
        )
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vorschlag nicht gefunden")

    max_sort_order = (
        db.query(func.max(Ingredient.sort_order))
        .filter(Ingredient.recipe_id == recipe_id)
        .scalar()
    ) or 0

    ingredient = Ingredient(
        recipe_id=recipe_id,
        name=body.name,
        amount=body.quantity,
        unit=body.unit,
        sort_order=max_sort_order + 1,
    )
    db.add(ingredient)
    db.flush()

    steps = (
        db.query(RecipeStep)
        .filter(RecipeStep.recipe_id == recipe_id, RecipeStep.id.in_(body.step_ids))
        .all()
    )
    for step in steps:
        current_ids = step.ingredient_ids if step.ingredient_ids is not None else (step.ingredient_ids_auto or [])
        if ingredient.id not in current_ids:
            step.ingredient_ids = [*current_ids, ingredient.id]

    suggestion.status = "accepted"
    db.commit()

    step_scanner.revalidate_open_suggestions(recipe_id, db)

    db.refresh(ingredient)
    return ingredient


@router.post("/{recipe_id}/step-suggestions/{suggestion_id}/dismiss")
def dismiss_step_suggestion(
    recipe_id: int,
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = _get_or_404(recipe_id, db)
    _require_author_or_chef(recipe, current_user)

    suggestion = (
        db.query(StepUnmatchedSuggestion)
        .filter(
            StepUnmatchedSuggestion.id == suggestion_id,
            StepUnmatchedSuggestion.recipe_id == recipe_id,
        )
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vorschlag nicht gefunden")

    suggestion.status = "dismissed"
    db.commit()
    return {"ok": True}


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(
    body: RecipeCreate,
    background_tasks: BackgroundTasks,
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
        type=body.type,
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
    background_tasks.add_task(step_scanner.trigger_step_scan, recipe.id)
    return _load_full(recipe.id, db)


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: int,
    body: RecipeUpdate,
    background_tasks: BackgroundTasks,
    skip_version: bool = Query(False),
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

    scalar_fields = {"title", "description", "prep_time", "cook_time", "servings", "difficulty", "status", "type", "source"}
    for field in body.model_fields_set & scalar_fields:
        setattr(recipe, field, getattr(body, field))

    if body.category_ids is not None:
        recipe.categories = _resolve_categories(body.category_ids, db)

    if body.tag_ids is not None:
        recipe.tags = _resolve_tags(body.tag_ids, db)

    ingredients_changed = body.ingredients is not None
    if body.ingredients is not None:
        recipe.ingredients = [Ingredient(**ing.model_dump()) for ing in body.ingredients]

    steps_changed = False
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
                steps_changed = True
        new_ids = {s.id for s in new_steps if s.id}
        for old_id, old_step in existing.items():
            if old_id not in new_ids:
                db.delete(old_step)
                steps_changed = True
        recipe.steps = new_steps

    db.flush()
    if not skip_version:
        save_version(recipe, old_snapshot, current_user.id, db)
    db.commit()

    if steps_changed:
        background_tasks.add_task(step_scanner.trigger_step_scan, recipe_id)
    if ingredients_changed:
        step_scanner.revalidate_open_suggestions(recipe_id, db)

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
