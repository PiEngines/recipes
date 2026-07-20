from datetime import date

from pydantic import BaseModel


class BeetAddRequest(BaseModel):
    plant_slug: str


class BeetItem(BaseModel):
    user_plant_id: int
    plant_slug: str
    deutscher_name: str
    planted_on: date
    # Abgeleitet aus dem Pflanzenkalender für den aktuellen Monat:
    # "aussaat" | "waechst" | "ernte"
    phase_badge: str
    model_config = {"from_attributes": True}


class BeetPatchRequest(BaseModel):
    planted_on: date


class GardenTask(BaseModel):
    """Eine im Zeitraum fällige Aufgabe bzw. ein laufender Status."""

    user_plant_id: int
    plant_slug: str
    deutscher_name: str
    task_key: str
    aktivitaet: str
    hinweis: str | None = None
    phase_von_name: str | None = None
    phase_bis_name: str | None = None
    period_key: str
    # Laufende Tätigkeiten und Blühzeit-Vermerke sind Status, nicht abhakbar.
    actionable: bool
    done: bool


class GardenTasksResponse(BaseModel):
    scope: str
    period_key: str
    monat: int
    tasks: list[GardenTask] = []
