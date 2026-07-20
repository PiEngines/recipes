"""Beet-Fundament (F1/B1).

  POST   /api/garden/beet               – Pflanze ins eigene Beet legen (idempotent)
  DELETE /api/garden/beet/{plant_slug}  – Pflanze aus dem eigenen Beet entfernen
  GET    /api/garden/beet               – eigenes Beet auflisten

Alle Endpoints eingeloggt, ausschließlich das eigene Beet. F2 (Mein-Beet-Seite,
Kalender, Task-Engine) setzt auf diesem Kern auf.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.garden.schemas import BeetAddRequest, BeetItem
from app.models import Plant, User, UserPlant
from app.plants.permissions import can_view_plants, can_view_unreleased

router = APIRouter(prefix="/api/garden", tags=["garden"])


def _plant_or_404(db: Session, slug: str, user: User) -> Plant:
    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None:
        raise HTTPException(status_code=404, detail="Pflanze nicht gefunden")
    if not plant.redaktion_freigegeben and not can_view_unreleased(user):
        raise HTTPException(status_code=404, detail="Pflanze nicht gefunden")
    return plant


def _item(plant: Plant, entry: UserPlant) -> BeetItem:
    return BeetItem(
        plant_slug=plant.slug,
        deutscher_name=plant.deutscher_name,
        planted_on=entry.planted_on,
    )


@router.get("/beet", response_model=list[BeetItem])
def list_beet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not can_view_plants(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")

    rows = (
        db.query(UserPlant, Plant)
        .join(Plant, UserPlant.plant_id == Plant.id)
        .filter(UserPlant.user_id == current_user.id)
        .order_by(Plant.deutscher_name)
        .all()
    )
    return [_item(plant, entry) for entry, plant in rows]


@router.post("/beet", response_model=BeetItem)
def add_to_beet(
    body: BeetAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not can_view_plants(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")

    plant = _plant_or_404(db, body.plant_slug, current_user)

    existing = (
        db.query(UserPlant)
        .filter(UserPlant.user_id == current_user.id, UserPlant.plant_id == plant.id)
        .first()
    )
    if existing is not None:
        return _item(plant, existing)

    entry = UserPlant(user_id=current_user.id, plant_id=plant.id, planted_on=date.today())
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        # Paralleler Erstaufruf: Unique(user_id, plant_id) hat gegriffen —
        # vorhandenen Eintrag neu lesen statt 500 zu werfen.
        db.rollback()
        entry = (
            db.query(UserPlant)
            .filter(UserPlant.user_id == current_user.id, UserPlant.plant_id == plant.id)
            .first()
        )
        if entry is None:
            raise HTTPException(status_code=409, detail="Beet-Eintrag konnte nicht angelegt werden")
        return _item(plant, entry)

    db.refresh(entry)
    return _item(plant, entry)


@router.delete("/beet/{plant_slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_beet(
    plant_slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not can_view_plants(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")

    plant = _plant_or_404(db, plant_slug, current_user)
    db.query(UserPlant).filter(
        UserPlant.user_id == current_user.id, UserPlant.plant_id == plant.id
    ).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
