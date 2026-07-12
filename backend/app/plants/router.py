from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, aliased

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Plant, PlantRelation, PlantTag, User
from app.plants.permissions import can_view_plants, can_view_unreleased
from app.plants.schemas import (
    PlantDetail,
    PlantLaenderkuecheItem,
    PlantListItem,
    PlantRelationItem,
    PlantRelations,
    PlantTags,
)

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

    # Tags gruppieren
    tag_rows = db.query(PlantTag).filter(PlantTag.pflanzen_id == plant.id).all()
    passt_zu = sorted(t.canonical for t in tag_rows if t.facet == "passt_zu")
    kombiniert_mit = sorted(t.canonical for t in tag_rows if t.facet == "kombiniert_mit")
    laenderkueche = sorted(
        (
            PlantLaenderkuecheItem(name=t.canonical, ist_stil=t.ist_stil)
            for t in tag_rows
            if t.facet == "laenderkueche"
        ),
        key=lambda item: item.name,
    )
    tags = PlantTags(
        passt_zu=passt_zu,
        kombiniert_mit=kombiniert_mit,
        laenderkueche=laenderkueche,
    )

    # Relationen gruppieren (Left-Join auf Ziel-Pflanze für Name/Slug)
    target = aliased(Plant)
    relation_rows = (
        db.query(
            PlantRelation,
            target.deutscher_name,
            target.slug,
            target.redaktion_freigegeben,
        )
        .outerjoin(target, PlantRelation.ziel_pflanze_id == target.id)
        .filter(PlantRelation.pflanzen_id == plant.id)
        .all()
    )
    groups: dict[str, list[PlantRelationItem]] = {
        "mischkultur_gut": [],
        "mischkultur_schlecht": [],
        "ersatz": [],
    }
    for rel, ziel_deutscher_name, ziel_slug, ziel_freigegeben in relation_rows:
        if rel.ziel_typ == "pflanze":
            # Zielpflanze ohne Freigabe für nicht-privilegierte User verbergen
            if not can_view_unreleased(current_user) and not ziel_freigegeben:
                continue
            ziel_name = ziel_deutscher_name
            resolved_slug = ziel_slug
        else:
            ziel_name = rel.ziel_name
            resolved_slug = None
        item = PlantRelationItem(
            ziel_typ=rel.ziel_typ,
            ziel_name=ziel_name,
            ziel_slug=resolved_slug,
            qualifier=rel.qualifier or None,
        )
        if rel.beziehung in groups:
            groups[rel.beziehung].append(item)
    for items in groups.values():
        items.sort(key=lambda item: item.ziel_name)
    relationen = PlantRelations(**groups)

    detail = PlantDetail.model_validate(plant)
    detail.tags = tags
    detail.relationen = relationen
    return detail
