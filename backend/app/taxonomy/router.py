from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.category import DietLabel, Allergen, Exclusion
from app.models.recipe import Recipe

router = APIRouter(prefix="/api", tags=["taxonomy"])

@router.get("/diet-labels")
def list_diet_labels(db: Session = Depends(get_db)):
    return [{"id": d.id, "name": d.name} for d in db.query(DietLabel).order_by(DietLabel.name).all()]

@router.get("/allergens")
def list_allergens(db: Session = Depends(get_db)):
    return [{"id": a.id, "name": a.name} for a in db.query(Allergen).order_by(Allergen.name).all()]

@router.get("/exclusions")
def list_exclusions(db: Session = Depends(get_db)):
    return [{"id": e.id, "name": e.name} for e in db.query(Exclusion).order_by(Exclusion.name).all()]

@router.get("/courses")
def list_courses(db: Session = Depends(get_db)):
    rows = db.query(Recipe.course).filter(Recipe.course.isnot(None), Recipe.deleted_at.is_(None)).distinct().all()
    return sorted({r[0] for r in rows if r[0]})
