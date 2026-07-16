from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.dependencies import get_current_user, get_optional_user
from app.models.user import User
from app.models.recipe import Recipe
from app.models.rating import Rating
from app.ratings.schemas import RatingIn, RatingAggregate

router = APIRouter(prefix="/api/recipes", tags=["ratings"])

def _aggregate(db, recipe_id, user):
    avg, count = db.query(func.avg(Rating.stars), func.count(Rating.id)).filter(Rating.recipe_id == recipe_id).one()
    my = None
    if user is not None:
        r = db.query(Rating).filter(Rating.recipe_id == recipe_id, Rating.user_id == user.id).first()
        my = r.stars if r else None
    return RatingAggregate(avg=round(float(avg), 1) if avg is not None else None, count=count, my_stars=my)

def _recipe_or_404(db, recipe_id):
    r = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    return r

@router.put("/{recipe_id}/rating", response_model=RatingAggregate)
def rate(recipe_id: int, body: RatingIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    recipe = _recipe_or_404(db, recipe_id)
    if recipe.created_by == user.id:
        raise HTTPException(status_code=403, detail="Eigenes Rezept kann nicht bewertet werden")
    existing = db.query(Rating).filter(Rating.recipe_id == recipe_id, Rating.user_id == user.id).first()
    if existing:
        existing.stars = body.stars
    else:
        db.add(Rating(recipe_id=recipe_id, user_id=user.id, stars=body.stars))
    db.commit()
    return _aggregate(db, recipe_id, user)

@router.delete("/{recipe_id}/rating", response_model=RatingAggregate)
def unrate(recipe_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Rating).filter(Rating.recipe_id == recipe_id, Rating.user_id == user.id).delete()
    db.commit()
    return _aggregate(db, recipe_id, user)

@router.get("/{recipe_id}/rating", response_model=RatingAggregate)
def get_rating(recipe_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    return _aggregate(db, recipe_id, user)
