from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Plant, User
from app.plants.permissions import can_view_plants, can_view_unreleased
from app.plants.schemas import PlantDetail, PlantListItem

router = APIRouter(prefix="/api/plants", tags=["plants"])


@router.get("", response_model=list[PlantListItem])
def list_plants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not can_view_plants(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")

    query = db.query(Plant)
    if not can_view_unreleased(current_user):
        query = query.filter(Plant.redaktion_freigegeben.is_(True))

    return query.order_by(Plant.deutscher_name).all()


@router.get("/{slug}", response_model=PlantDetail)
def get_plant(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not can_view_plants(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")

    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None:
        raise HTTPException(status_code=404, detail="Pflanze nicht gefunden")
    if not plant.redaktion_freigegeben and not can_view_unreleased(current_user):
        raise HTTPException(status_code=404, detail="Pflanze nicht gefunden")

    return plant
