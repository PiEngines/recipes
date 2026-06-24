from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Ingredient, Recipe, RecipeComponent, User
from app.models.recipe import RecipeStatus
from app.modules.service import embed_module
from app.recipes.schemas import (
    ComponentCreate,
    ComponentResponse,
    ExtractComponentBody,
    ExtractComponentResponse,
    UsedInResponse,
)

router = APIRouter(prefix="/api/recipes", tags=["modules"])


@router.post(
    "/{recipe_id}/components",
    response_model=ComponentResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_component(
    recipe_id: int,
    body: ComponentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    if recipe.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Zugriff verweigert")

    component = embed_module(
        db=db,
        parent_recipe_id=recipe_id,
        child_recipe_id=body.child_recipe_id,
        user_id=current_user.id,
        sort_order=body.sort_order,
        flatten_into_parent=True,
        servings_override=body.servings_override,
        scale_factor=body.scale_factor,
    )
    db.commit()
    db.refresh(component)
    return component


@router.post(
    "/{recipe_id}/components/extract",
    response_model=ExtractComponentResponse,
    status_code=status.HTTP_201_CREATED,
)
def extract_component(
    recipe_id: int,
    body: ExtractComponentBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract an ingredient group into a standalone recipe and replace it with a module reference."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    if recipe.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Zugriff verweigert")

    if body.component_label:
        group_ings = (
            db.query(Ingredient)
            .filter(
                Ingredient.recipe_id == recipe_id,
                Ingredient.component_label == body.component_label,
            )
            .order_by(Ingredient.sort_order)
            .all()
        )
    else:
        group_ings = (
            db.query(Ingredient)
            .filter(
                Ingredient.recipe_id == recipe_id,
                Ingredient.component_label.is_(None),
            )
            .order_by(Ingredient.sort_order)
            .all()
        )

    if not group_ings:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gruppe nicht gefunden")

    try:
        min_sort_order = group_ings[0].sort_order

        new_recipe = Recipe(
            title=body.new_recipe_title,
            created_by=current_user.id,
            author_id=current_user.id,
            status=RecipeStatus.draft,
            type=recipe.type,
        )
        db.add(new_recipe)
        db.flush()

        for ing in group_ings:
            db.add(Ingredient(
                recipe_id=new_recipe.id,
                component_label=None,
                name=ing.name,
                amount=ing.amount,
                unit=ing.unit,
                sort_order=ing.sort_order,
                is_integer=ing.is_integer,
            ))
        db.flush()

        embed_module(
            db=db,
            parent_recipe_id=recipe_id,
            child_recipe_id=new_recipe.id,
            user_id=current_user.id,
            sort_order=min_sort_order,
            flatten_into_parent=True,
        )

        for ing in group_ings:
            db.delete(ing)

        db.commit()

        return ExtractComponentResponse(
            new_recipe_id=new_recipe.id,
            new_recipe_title=new_recipe.title,
            component_id=new_recipe.id,
        )
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Fehler beim Auslagern der Gruppe")


@router.delete("/{recipe_id}/components/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_component(
    recipe_id: int,
    component_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    if recipe.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Zugriff verweigert")

    component = db.query(RecipeComponent).filter(
        RecipeComponent.parent_recipe_id == recipe_id,
        RecipeComponent.child_recipe_id == component_id,
    ).first()
    if not component:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Komponente nicht gefunden")

    db.delete(component)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{recipe_id}/used-in", response_model=UsedInResponse)
def used_in(
    recipe_id: int,
    db: Session = Depends(get_db),
):
    count = (
        db.query(func.count(RecipeComponent.parent_recipe_id))
        .filter(RecipeComponent.child_recipe_id == recipe_id)
        .scalar()
    ) or 0
    return UsedInResponse(count=count)
