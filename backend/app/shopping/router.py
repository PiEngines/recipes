"""Einkaufsliste (F2b/S1).

  GET    /api/shopping-list?group=recipe|sum   – Liste + Fortschritt
  POST   /api/shopping-list/items              – manuelle Position
  POST   /api/shopping-list/from-recipe        – Zutaten aus einem Rezept übernehmen
  PATCH  /api/shopping-list/items/{id}         – abhaken / bearbeiten
  DELETE /api/shopping-list/items/{id}         – Position entfernen
  POST   /api/shopping-list/clear-done         – alle erledigten entfernen

v1: genau eine implizite Liste je User. Alle Endpoints sind owner-scoped —
fremde Positionen sind nicht unterscheidbar von nicht vorhandenen (404).
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Ingredient, Recipe, ShoppingListItem, User
from app.recipes.router import _apply_visibility_filter
from app.shopping.aggregate import aggregate_items
from app.shopping.schemas import (
    ClearDoneResponse,
    FromRecipeRequest,
    FromRecipeResponse,
    ItemPatch,
    ManualItemCreate,
    ShoppingGroup,
    ShoppingItem,
    ShoppingListResponse,
    ShoppingProgress,
    ShoppingSumItem,
)
from app.utils.scaling import scale_amount

router = APIRouter(prefix="/api/shopping-list", tags=["shopping-list"])

MANUAL_GROUP_TITLE = "Ohne Rezept · manuell"


def _items(db: Session, user: User) -> list[ShoppingListItem]:
    return (
        db.query(ShoppingListItem)
        .filter(ShoppingListItem.user_id == user.id)
        .order_by(ShoppingListItem.sort_order, ShoppingListItem.id)
        .all()
    )


def _own_item_or_404(db: Session, item_id: int, user: User) -> ShoppingListItem:
    item = (
        db.query(ShoppingListItem)
        .filter(ShoppingListItem.id == item_id, ShoppingListItem.user_id == user.id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Position nicht gefunden")
    return item


def _progress(items: list[ShoppingListItem]) -> ShoppingProgress:
    """Fortschritt zählt immer Einzel-Positionen — auch in der summierten Ansicht."""
    total = len(items)
    done = sum(1 for i in items if i.checked)
    percent = round(done * 100 / total) if total else 0
    return ShoppingProgress(total=total, done=done, percent=percent)


def _next_sort_order(db: Session, user: User) -> int:
    last = (
        db.query(ShoppingListItem)
        .filter(ShoppingListItem.user_id == user.id)
        .order_by(ShoppingListItem.sort_order.desc())
        .first()
    )
    return (last.sort_order + 1) if last else 0


@router.get("", response_model=ShoppingListResponse)
def get_list(
    group: Literal["recipe", "sum"] = Query(default="recipe"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = _items(db, current_user)
    progress = _progress(items)

    if group == "sum":
        return ShoppingListResponse(
            group=group,
            progress=progress,
            items=[ShoppingSumItem(**row) for row in aggregate_items(items)],
        )

    # Nach Rezept: Gruppen in Anlege-Reihenfolge, manuelle Positionen zuletzt.
    groups: dict[object, list[ShoppingListItem]] = {}
    order: list[object] = []
    for item in items:
        key = item.recipe_id if item.recipe_id is not None else (item.recipe_title or None)
        if item.recipe_title is None and item.recipe_id is None:
            key = None
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(item)

    manual_last = [k for k in order if k is not None] + [k for k in order if k is None]

    out = []
    for key in manual_last:
        bucket = groups[key]
        first = bucket[0]
        out.append(ShoppingGroup(
            recipe_id=first.recipe_id,
            recipe_title=first.recipe_title or MANUAL_GROUP_TITLE,
            position_count=len(bucket),
            items=[ShoppingItem.model_validate(i) for i in bucket],
        ))

    return ShoppingListResponse(group=group, progress=progress, groups=out)


@router.post("/items", response_model=ShoppingItem, status_code=status.HTTP_201_CREATED)
def add_manual_item(
    body: ManualItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = ShoppingListItem(
        user_id=current_user.id,
        name=body.name.strip(),
        amount=(body.amount or None),
        unit=(body.unit or None),
        checked=False,
        sort_order=_next_sort_order(db, current_user),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ShoppingItem.model_validate(item)


@router.post("/from-recipe", response_model=FromRecipeResponse, status_code=status.HTTP_201_CREATED)
def add_from_recipe(
    body: FromRecipeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Zutaten eines Rezepts übernehmen — Mengen auf `servings` eingefroren."""
    visible = _apply_visibility_filter(
        db.query(Recipe).filter(Recipe.id == body.recipe_id, Recipe.deleted_at.is_(None)),
        current_user,
        db,
    )
    recipe = visible.first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")

    ingredients = db.query(Ingredient).filter(Ingredient.recipe_id == recipe.id).all()
    by_id = {i.id: i for i in ingredients}

    unbekannt = [i for i in body.ingredient_ids if i not in by_id]
    if unbekannt:
        raise HTTPException(
            status_code=422,
            detail=f"Zutaten gehören nicht zu diesem Rezept: {unbekannt}",
        )

    basis = recipe.servings or body.servings
    sort_order = _next_sort_order(db, current_user)
    added = 0
    # Reihenfolge des Rezepts beibehalten, nicht die der übergebenen IDs.
    gewaehlt = set(body.ingredient_ids)
    for ing in sorted(ingredients, key=lambda i: (i.sort_order, i.id)):
        if ing.id not in gewaehlt:
            continue
        amount = ing.amount
        if amount and basis:
            # Gleiche Skalierungsquelle wie Detail/Zutaten-Panel.
            amount = scale_amount(amount, basis, body.servings)
        db.add(ShoppingListItem(
            user_id=current_user.id,
            recipe_id=recipe.id,
            recipe_title=recipe.title,
            name=ing.name,
            amount=amount or None,
            unit=ing.unit or None,
            checked=False,
            sort_order=sort_order + added,
        ))
        added += 1

    db.commit()
    return FromRecipeResponse(added=added)


@router.patch("/items/{item_id}", response_model=ShoppingItem)
def patch_item(
    item_id: int,
    body: ItemPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _own_item_or_404(db, item_id, current_user)
    data = body.model_dump(exclude_unset=True)
    if "checked" in data and data["checked"] is not None:
        item.checked = data["checked"]
    if "name" in data and data["name"] is not None:
        item.name = data["name"].strip()
    if "amount" in data:
        item.amount = data["amount"] or None
    if "unit" in data:
        item.unit = data["unit"] or None
    db.commit()
    db.refresh(item)
    return ShoppingItem.model_validate(item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _own_item_or_404(db, item_id, current_user)
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/clear-done", response_model=ClearDoneResponse)
def clear_done(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    removed = (
        db.query(ShoppingListItem)
        .filter(ShoppingListItem.user_id == current_user.id, ShoppingListItem.checked.is_(True))
        .delete(synchronize_session=False)
    )
    db.commit()
    return ClearDoneResponse(removed=removed)
