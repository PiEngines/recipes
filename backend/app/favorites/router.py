from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, subqueryload

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.models import Recipe, User, UserFavorite
from app.recipes.schemas import RecipeListItem

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


@router.post("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(
    recipe_id: int,
    current_user: User = Depends(require_koch_or_above),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")

    existing = (
        db.query(UserFavorite)
        .filter(UserFavorite.user_id == current_user.id, UserFavorite.recipe_id == recipe_id)
        .first()
    )
    if existing:
        return

    db.add(UserFavorite(user_id=current_user.id, recipe_id=recipe_id))
    db.commit()


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    recipe_id: int,
    current_user: User = Depends(require_koch_or_above),
    db: Session = Depends(get_db),
):
    db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id, UserFavorite.recipe_id == recipe_id
    ).delete()
    db.commit()


@router.get("", response_model=list[RecipeListItem])
def list_favorites(
    current_user: User = Depends(require_koch_or_above),
    db: Session = Depends(get_db),
):
    favorites = (
        db.query(UserFavorite)
        .filter(UserFavorite.user_id == current_user.id)
        .order_by(UserFavorite.created_at.desc())
        .all()
    )
    recipe_ids = [f.recipe_id for f in favorites]
    if not recipe_ids:
        return []

    recipes = (
        db.query(Recipe)
        .filter(Recipe.id.in_(recipe_ids))
        .options(
            subqueryload(Recipe.categories),
            subqueryload(Recipe.tags),
            joinedload(Recipe.author),
        )
        .all()
    )
    by_id = {r.id: r for r in recipes}
    ordered = [by_id[rid] for rid in recipe_ids if rid in by_id]

    # Primärbild + Rating serverseitig anreichern (eine Quelle: recipes/router).
    from app.recipes.router import _attach_primary_images, _attach_ratings
    _attach_primary_images(ordered, db)
    _attach_ratings(ordered, db)
    return ordered
