import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from sqlalchemy import func
from app.database import get_db
from app.models.associations import recipe_categories
from app.models.category import Category
from app.models.recipe import Recipe


def _levenshtein(a: str, b: str) -> int:
    a, b = a.lower(), b.lower()
    prev = list(range(len(b) + 1))
    for ca in a:
        curr = [prev[0] + 1]
        for j, cb in enumerate(b, 1):
            curr.append(min(prev[j] + 1, curr[-1] + 1, prev[j - 1] + (ca != cb)))
        prev = curr
    return prev[-1]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "unnamed"


class CategoryCreate(BaseModel):
    name: str


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    recipe_count: int = 0
    model_config = {"from_attributes": True}


router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Category)
    if search:
        q = q.filter(Category.name.ilike(f"%{search}%"))
    cats = q.order_by(Category.name).limit(30).all()

    counts = dict(
        db.query(recipe_categories.c.category_id, func.count(Recipe.id))
        .join(Recipe, Recipe.id == recipe_categories.c.recipe_id)
        .filter(Recipe.deleted_at.is_(None))
        .group_by(recipe_categories.c.category_id)
        .all()
    )
    return [
        CategoryOut(id=c.id, name=c.name, slug=c.slug, recipe_count=counts.get(c.id, 0))
        for c in cats
    ]


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name darf nicht leer sein")

    existing = db.query(Category).filter(Category.name.ilike(name)).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"message": "Kategorie existiert bereits", "suggestion": existing.name, "suggestion_id": existing.id},
        )

    for cat in db.query(Category).all():
        if _levenshtein(name, cat.name) <= 2:
            raise HTTPException(
                status_code=409,
                detail={"message": "Ähnliche Kategorie gefunden", "suggestion": cat.name, "suggestion_id": cat.id},
            )

    obj = Category(name=name, slug=_slugify(name))
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
