"""Kraut des Monats — die Auswahl-Logik, gemeinsam genutzt.

Herausgelöst aus `plants/router.py`, weil seit F3b-3 zwei Aufrufer denselben
Pick brauchen: `GET /api/plants/spotlight` und der globale Feed. Ein zweites
Mal implementiert wäre die Auswahl nicht nur doppelt gepflegt, sondern
gefährlich — sie *schreibt* (ein Pick je Periode) und ist deterministisch
geseedet. Zwei Implementierungen könnten auseinanderlaufen.

`_active_phases` liegt ebenfalls hier, damit der Kalender-Endpoint und die
Pool-Bildung dieselbe Definition „im Monat aktiv" verwenden.
"""
import random
from dataclasses import dataclass
from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Phaenophase, Plant, PlantCalendar, PlantSpotlightHistory, User
from app.plants.permissions import can_view_plants, can_view_unreleased
from app.plants.schemas import PlantSpotlight


@dataclass
class SpotlightPick:
    """Der Pick plus der Zeitpunkt, zu dem er entstand.

    `created_at` braucht nur der Feed: dort ist das Kraut ein Item unter
    anderen und muss sich in den `created_at`-Stream einsortieren.
    """

    spotlight: PlantSpotlight
    created_at: datetime


def active_phases(monat: int, phaeno_rows: list[Phaenophase]) -> list[int]:
    active = []
    for p in phaeno_rows:
        von, bis = p.ref_monat_von, p.ref_monat_bis
        hit = (von <= monat <= bis) if von <= bis else (monat >= von or monat <= bis)
        if hit:
            active.append(p.phase_id)
    return sorted(active)


def _recent_period_keys(period_key: str, count: int) -> list[str]:
    """Die `count` period_keys unmittelbar vor `period_key` (absteigend)."""
    jahr, monat = (int(x) for x in period_key.split("-"))
    keys = []
    for _ in range(count):
        monat -= 1
        if monat == 0:
            monat, jahr = 12, jahr - 1
        keys.append(f"{jahr:04d}-{monat:02d}")
    return keys


def resolve_spotlight(db: Session, current_user: User) -> SpotlightPick | None:
    """Kraut des Monats — innerhalb eines Monats stabil, 12 Monate Cooldown.

    Gibt `None` zurück, wenn der Nutzer keinen Pflanzen-Zugriff hat oder kein
    Kandidat existiert. Der Aufrufer entscheidet, was das bedeutet: der
    Endpoint antwortet mit 403/404, der Feed lässt die Karte einfach weg.
    """
    if not can_view_plants(current_user):
        return None

    today = date.today()
    period_key = f"{today.year:04d}-{today.month:02d}"

    def _visible_plants():
        q = db.query(Plant)
        if not can_view_unreleased(current_user):
            q = q.filter(Plant.redaktion_freigegeben.is_(True))
        return q

    def _pick(row: PlantSpotlightHistory) -> SpotlightPick | None:
        plant = _visible_plants().filter(Plant.id == row.plant_id).first()
        if plant is None:
            return None
        return SpotlightPick(
            spotlight=PlantSpotlight(
                period_key=period_key,
                slug=plant.slug,
                deutscher_name=plant.deutscher_name,
                botanischer_name=plant.botanischer_name,
                teaser=plant.typische_verwendung,
            ),
            created_at=row.created_at,
        )

    def _persisted() -> PlantSpotlightHistory | None:
        return (
            db.query(PlantSpotlightHistory)
            .filter(PlantSpotlightHistory.period_key == period_key)
            .first()
        )

    existing = _persisted()
    if existing is not None:
        return _pick(existing)

    # Pool: Pflanzen mit saisonaler (phasengebundener) Aktivität im aktuellen
    # Monat. Ganzjährige Einträge (phase_von NULL) zählen nicht — sie träfen auf
    # fast jede Pflanze zu und würden die Saisonalität aushebeln.
    active_set = set(active_phases(today.month, db.query(Phaenophase).all()))
    seasonal_ids = {
        cal.pflanzen_id
        for cal in db.query(PlantCalendar).filter(PlantCalendar.phase_von.isnot(None)).all()
        if any(p in active_set for p in range(cal.phase_von, cal.phase_bis + 1))
    }

    candidates = _visible_plants().order_by(Plant.id).all()
    pool = [p for p in candidates if p.id in seasonal_ids] or candidates
    if not pool:
        return None

    # Cooldown: in den letzten 12 Perioden gezeigte Pflanzen ausschließen.
    recent_ids = {
        row.plant_id
        for row in db.query(PlantSpotlightHistory)
        .filter(PlantSpotlightHistory.period_key.in_(_recent_period_keys(period_key, 12)))
        .all()
    }
    eligible = [p for p in pool if p.id not in recent_ids] or pool

    # Deterministisch geseedet mit period_key — gleicher Monat, gleiche Wahl.
    chosen = random.Random(period_key).choice(eligible)

    row = PlantSpotlightHistory(plant_id=chosen.id, period_key=period_key)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # Paralleler Erstaufruf: Unique(period_key) hat gegriffen — den bereits
        # persistierten Pick neu lesen statt einen zweiten anzulegen.
        db.rollback()
        concurrent = _persisted()
        if concurrent is None:
            raise HTTPException(status_code=409, detail="Spotlight konnte nicht ermittelt werden")
        return _pick(concurrent)

    db.refresh(row)  # created_at ist server_default — erst nach dem Commit gesetzt
    return _pick(row)
