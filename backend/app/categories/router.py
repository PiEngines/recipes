import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.category import Category


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
    return q.order_by(Category.name).limit(30).all()


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
            detail={"message": "Kategorie existiert bereits", "suggestion": existing.name},
        )

    for cat in db.query(Category).all():
        if _levenshtein(name, cat.name) <= 2:
            raise HTTPException(
                status_code=409,
                detail={"message": "Ähnliche Kategorie gefunden", "suggestion": cat.name},
            )

    obj = Category(name=name, slug=_slugify(name))
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
