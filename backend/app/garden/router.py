"""Mein Beet (F1/B1) + abgeleitete Beet-Aufgaben (F2a/G1).

  GET    /api/garden/beet                       – eigenes Beet (inkl. Phase-Badge)
  POST   /api/garden/beet                       – Pflanze hinzufügen (idempotent)
  PATCH  /api/garden/beet/{plant_slug}          – planted_on korrigieren
  DELETE /api/garden/beet/{plant_slug}          – Pflanze entfernen
  GET    /api/garden/tasks                      – im Monat fällige Aufgaben/Status
  POST   /api/garden/tasks/{id}/{key}/done      – Aufgabe abhaken
  DELETE /api/garden/tasks/{id}/{key}/done      – Haken entfernen

Alle Endpoints eingeloggt, ausschließlich das eigene Beet.
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.garden.schemas import (
    BeetAddRequest,
    BeetItem,
    BeetPatchRequest,
    GardenTask,
    GardenTasksResponse,
)
from app.garden.tasks import derive_entries, phase_badge
from app.models import (
    Phaenophase,
    Plant,
    PlantCalendar,
    User,
    UserPlant,
    UserPlantTaskDone,
)
from app.plants.permissions import can_view_plants, can_view_unreleased

router = APIRouter(prefix="/api/garden", tags=["garden"])


def _period_key(today: date | None = None) -> str:
    d = today or date.today()
    return f"{d.year:04d}-{d.month:02d}"


def _require_access(user: User) -> None:
    if not can_view_plants(user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")


def _plant_or_404(db: Session, slug: str, user: User) -> Plant:
    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None:
        raise HTTPException(status_code=404, detail="Pflanze nicht gefunden")
    if not plant.redaktion_freigegeben and not can_view_unreleased(user):
        raise HTTPException(status_code=404, detail="Pflanze nicht gefunden")
    return plant


def _phase_map(db: Session) -> dict:
    return {p.phase_id: p for p in db.query(Phaenophase).all()}


def _calendar_by_plant(db: Session, plant_ids: list[str]) -> dict[str, list[PlantCalendar]]:
    if not plant_ids:
        return {}
    rows = db.query(PlantCalendar).filter(PlantCalendar.pflanzen_id.in_(plant_ids)).all()
    grouped: dict[str, list[PlantCalendar]] = {}
    for row in rows:
        grouped.setdefault(row.pflanzen_id, []).append(row)
    return grouped


def _beet_rows(db: Session, user: User):
    return (
        db.query(UserPlant, Plant)
        .join(Plant, UserPlant.plant_id == Plant.id)
        .filter(UserPlant.user_id == user.id)
        .order_by(Plant.deutscher_name)
        .all()
    )


def _item(plant: Plant, entry: UserPlant, badge: str) -> BeetItem:
    return BeetItem(
        user_plant_id=entry.id,
        plant_slug=plant.slug,
        deutscher_name=plant.deutscher_name,
        planted_on=entry.planted_on,
        phase_badge=badge,
    )


def _single_item(db: Session, plant: Plant, entry: UserPlant) -> BeetItem:
    monat = date.today().month
    entries = _calendar_by_plant(db, [plant.id]).get(plant.id, [])
    return _item(plant, entry, phase_badge(entries, monat, _phase_map(db)))


# ── Beet ─────────────────────────────────────────────────────────────────────

@router.get("/beet", response_model=list[BeetItem])
def list_beet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_access(current_user)
    rows = _beet_rows(db, current_user)
    monat = date.today().month
    pmap = _phase_map(db)
    calendars = _calendar_by_plant(db, [plant.id for _, plant in rows])
    return [
        _item(plant, entry, phase_badge(calendars.get(plant.id, []), monat, pmap))
        for entry, plant in rows
    ]


@router.post("/beet", response_model=BeetItem)
def add_to_beet(
    body: BeetAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_access(current_user)
    plant = _plant_or_404(db, body.plant_slug, current_user)

    existing = (
        db.query(UserPlant)
        .filter(UserPlant.user_id == current_user.id, UserPlant.plant_id == plant.id)
        .first()
    )
    if existing is not None:
        return _single_item(db, plant, existing)

    entry = UserPlant(user_id=current_user.id, plant_id=plant.id, planted_on=date.today())
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        # Paralleler Erstaufruf: Unique(user_id, plant_id) hat gegriffen.
        db.rollback()
        entry = (
            db.query(UserPlant)
            .filter(UserPlant.user_id == current_user.id, UserPlant.plant_id == plant.id)
            .first()
        )
        if entry is None:
            raise HTTPException(status_code=409, detail="Beet-Eintrag konnte nicht angelegt werden")
        return _single_item(db, plant, entry)

    db.refresh(entry)
    return _single_item(db, plant, entry)


@router.patch("/beet/{plant_slug}", response_model=BeetItem)
def patch_beet(
    plant_slug: str,
    body: BeetPatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pflanzdatum korrigieren (Add-Flow/Nachtrag)."""
    _require_access(current_user)
    plant = _plant_or_404(db, plant_slug, current_user)
    entry = (
        db.query(UserPlant)
        .filter(UserPlant.user_id == current_user.id, UserPlant.plant_id == plant.id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Pflanze liegt nicht in deinem Beet")

    entry.planted_on = body.planted_on
    db.commit()
    db.refresh(entry)
    return _single_item(db, plant, entry)


@router.delete("/beet/{plant_slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_beet(
    plant_slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_access(current_user)
    plant = _plant_or_404(db, plant_slug, current_user)
    db.query(UserPlant).filter(
        UserPlant.user_id == current_user.id, UserPlant.plant_id == plant.id
    ).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Aufgaben ─────────────────────────────────────────────────────────────────

@router.get("/tasks", response_model=GardenTasksResponse)
def list_tasks(
    # Die Kalenderdaten haben ausschließlich Monatsauflösung — eine Wochen-Linse
    # könnte nicht feiner filtern. `week` ist deshalb (noch) nicht vorgesehen.
    scope: Literal["month"] = Query(default="month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_access(current_user)

    today = date.today()
    period_key = _period_key(today)
    pmap = _phase_map(db)
    rows = _beet_rows(db, current_user)
    calendars = _calendar_by_plant(db, [plant.id for _, plant in rows])

    done_keys = {
        (d.user_plant_id, d.task_key)
        for d in db.query(UserPlantTaskDone)
        .filter(
            UserPlantTaskDone.user_plant_id.in_([e.id for e, _ in rows] or [-1]),
            UserPlantTaskDone.period_key == period_key,
        )
        .all()
    }

    tasks: list[GardenTask] = []
    for entry, plant in rows:
        for t in derive_entries(calendars.get(plant.id, []), today.month, pmap):
            tasks.append(GardenTask(
                user_plant_id=entry.id,
                plant_slug=plant.slug,
                deutscher_name=plant.deutscher_name,
                task_key=t["task_key"],
                aktivitaet=t["aktivitaet"],
                hinweis=t["hinweis"],
                phase_von_name=t["phase_von_name"],
                phase_bis_name=t["phase_bis_name"],
                period_key=period_key,
                actionable=t["actionable"],
                # Status-Einträge sind nie „erledigt".
                done=t["actionable"] and (entry.id, t["task_key"]) in done_keys,
            ))

    # Offene Aufgaben zuerst, dann erledigte, dann Status; darin nach Pflanze.
    tasks.sort(key=lambda t: (not t.actionable, t.done, t.deutscher_name, t.aktivitaet))
    return GardenTasksResponse(scope=scope, period_key=period_key, monat=today.month, tasks=tasks)


def _owned_user_plant(db: Session, user_plant_id: int, user: User) -> tuple[UserPlant, Plant]:
    row = (
        db.query(UserPlant, Plant)
        .join(Plant, UserPlant.plant_id == Plant.id)
        .filter(UserPlant.id == user_plant_id, UserPlant.user_id == user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Beet-Eintrag nicht gefunden")
    return row


def _validate_task_key(db: Session, plant: Plant, task_key: str) -> None:
    """Nur tatsächlich abgeleitete, abhakbare Aufgaben dürfen abgehakt werden —
    verhindert Fremdschlüssel-Müll in der Tabelle."""
    entries = _calendar_by_plant(db, [plant.id]).get(plant.id, [])
    derived = derive_entries(entries, date.today().month, _phase_map(db))
    if not any(t["task_key"] == task_key and t["actionable"] for t in derived):
        raise HTTPException(
            status_code=404,
            detail="Aufgabe ist für diese Pflanze in diesem Monat nicht abhakbar",
        )


@router.post("/tasks/{user_plant_id}/{task_key}/done", status_code=status.HTTP_204_NO_CONTENT)
def mark_task_done(
    user_plant_id: int,
    task_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_access(current_user)
    entry, plant = _owned_user_plant(db, user_plant_id, current_user)
    _validate_task_key(db, plant, task_key)

    period_key = _period_key()
    db.add(UserPlantTaskDone(user_plant_id=entry.id, task_key=task_key, period_key=period_key))
    try:
        db.commit()
    except IntegrityError:
        # Schon abgehakt (auch bei parallelem Doppelklick) — idempotent.
        db.rollback()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/tasks/{user_plant_id}/{task_key}/done", status_code=status.HTTP_204_NO_CONTENT)
def unmark_task_done(
    user_plant_id: int,
    task_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_access(current_user)
    entry, _plant = _owned_user_plant(db, user_plant_id, current_user)
    db.query(UserPlantTaskDone).filter(
        UserPlantTaskDone.user_plant_id == entry.id,
        UserPlantTaskDone.task_key == task_key,
        UserPlantTaskDone.period_key == _period_key(),
    ).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
