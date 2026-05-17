from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.category import Tag


def _levenshtein(a: str, b: str) -> int:
    a, b = a.lower(), b.lower()
    prev = list(range(len(b) + 1))
    for ca in a:
        curr = [prev[0] + 1]
        for j, cb in enumerate(b, 1):
            curr.append(min(prev[j] + 1, curr[-1] + 1, prev[j - 1] + (ca != cb)))
        prev = curr
    return prev[-1]


class TagCreate(BaseModel):
    name: str


class TagOut(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Tag)
    if search:
        q = q.filter(Tag.name.ilike(f"%{search}%"))
    return q.order_by(Tag.name).limit(30).all()


@router.post("", response_model=TagOut, status_code=201)
def create_tag(
    body: TagCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name darf nicht leer sein")

    existing = db.query(Tag).filter(Tag.name.ilike(name)).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"message": "Tag existiert bereits", "suggestion": existing.name, "suggestion_id": existing.id},
        )

    for tag in db.query(Tag).all():
        if _levenshtein(name, tag.name) <= 2:
            raise HTTPException(
                status_code=409,
                detail={"message": "Ähnlichen Tag gefunden", "suggestion": tag.name, "suggestion_id": tag.id},
            )

    obj = Tag(name=name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
