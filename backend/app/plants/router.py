from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Phaenophase, Plant, PlantCalendar, PlantRelation, PlantTag, User
from app.plants.permissions import can_view_plants, can_view_unreleased
from app.plants.schemas import (
    CalendarActivityItem,
    MonthCalendar,
    PlantCalendarGrouped,
    PlantCalendarItem,
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


def _active_phases(monat: int, phaeno_rows: list[Phaenophase]) -> list[int]:
    active = []
    for p in phaeno_rows:
        von, bis = p.ref_monat_von, p.ref_monat_bis
        hit = (von <= monat <= bis) if von <= bis else (monat >= von or monat <= bis)
        if hit:
            active.append(p.phase_id)
    return sorted(active)


@router.get("/calendar", response_model=MonthCalendar)
def get_month_calendar(
    monat: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not can_view_plants(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")

    if monat is None:
        monat = date.today().month

    phaeno_rows = db.query(Phaenophase).all()
    active = _active_phases(monat, phaeno_rows)
    active_set = set(active)

    query = db.query(PlantCalendar, Plant.deutscher_name, Plant.slug).join(
        Plant, PlantCalendar.pflanzen_id == Plant.id
    )
    if not can_view_unreleased(current_user):
        query = query.filter(Plant.redaktion_freigegeben.is_(True))

    eintraege: list[CalendarActivityItem] = []
    for cal, ziel_name, ziel_slug in query.all():
        if cal.phase_von is None:
            aktiv = True  # ganzjährig (z. B. Pflege allgemein)
        else:
            aktiv = any(p in active_set for p in range(cal.phase_von, cal.phase_bis + 1))
        if not aktiv:
            continue
        eintraege.append(CalendarActivityItem(
            pflanzen_id=cal.pflanzen_id,
            pflanze_name=ziel_name,
            pflanze_slug=ziel_slug,
            kategorie=cal.kategorie,
            aktivitaet=cal.aktivitaet,
            phase_von=cal.phase_von,
            phase_bis=cal.phase_bis,
            laufend=cal.laufend,
            hinweis=cal.hinweis,
        ))
    eintraege.sort(key=lambda e: (e.pflanze_name, e.kategorie, e.aktivitaet))
    return MonthCalendar(monat=monat, aktive_phasen=active, eintraege=eintraege)


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

    # Kalender gruppieren (Phase 3), Phasennamen aufgelöst
    phase_name = {p.phase_id: p.phase_name for p in db.query(Phaenophase).all()}
    cal_rows = (
        db.query(PlantCalendar)
        .filter(PlantCalendar.pflanzen_id == plant.id)
        .order_by(PlantCalendar.kategorie, PlantCalendar.aktivitaet)
        .all()
    )
    kalender_groups: dict[str, list[PlantCalendarItem]] = {"anbau": [], "nutzung": [], "pflege": []}
    kat_map = {"Anbau": "anbau", "Nutzung": "nutzung", "Pflege": "pflege"}
    for c in cal_rows:
        kalender_groups[kat_map[c.kategorie]].append(PlantCalendarItem(
            kategorie=c.kategorie,
            aktivitaet=c.aktivitaet,
            phase_von=c.phase_von,
            phase_bis=c.phase_bis,
            phase_von_name=phase_name.get(c.phase_von) if c.phase_von else None,
            phase_bis_name=phase_name.get(c.phase_bis) if c.phase_bis else None,
            laufend=c.laufend,
            hinweis=c.hinweis,
        ))
    kalender = PlantCalendarGrouped(**kalender_groups)

    detail = PlantDetail.model_validate(plant)
    detail.tags = tags
    detail.relationen = relationen
    detail.kalender = kalender
    return detail
