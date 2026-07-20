from pydantic import BaseModel


class PlantListItem(BaseModel):
    id: str
    slug: str
    deutscher_name: str
    botanischer_name: str | None = None
    hauptkategorie: str | None = None
    # Nebenetikett — die Übersicht füllt darüber das Heilkräuter-Regal
    # querschnittlich (z. B. Salbei: Küchenkraut + Heilpflanze).
    weitere_kategorien: str | None = None
    bild_dateiname: str | None = None
    essbarkeit: str
    warnung: str | None = None
    redaktion_freigegeben: bool
    model_config = {"from_attributes": True}


class PlantLaenderkuecheItem(BaseModel):
    name: str
    ist_stil: bool


class PlantTags(BaseModel):
    passt_zu: list[str] = []
    kombiniert_mit: list[str] = []
    laenderkueche: list[PlantLaenderkuecheItem] = []


class PlantRelationItem(BaseModel):
    ziel_typ: str
    ziel_name: str
    ziel_slug: str | None = None
    qualifier: str | None = None


class PlantRelations(BaseModel):
    mischkultur_gut: list[PlantRelationItem] = []
    mischkultur_schlecht: list[PlantRelationItem] = []
    ersatz: list[PlantRelationItem] = []


class PlantCalendarItem(BaseModel):
    kategorie: str
    aktivitaet: str
    phase_von: int | None = None
    phase_bis: int | None = None
    phase_von_name: str | None = None
    phase_bis_name: str | None = None
    laufend: bool
    hinweis: str | None = None


class PlantCalendarGrouped(BaseModel):
    anbau: list[PlantCalendarItem] = []
    nutzung: list[PlantCalendarItem] = []
    pflege: list[PlantCalendarItem] = []


class PlantDetail(PlantListItem):
    botanische_familie: str | None = None
    # weitere_kategorien wird von PlantListItem geerbt (vormals hier redundant
    # redeklariert) — Response-Vertrag unverändert.
    synonyme: str | None = None
    quelle_botanik: str | None = None
    typische_verwendung: str | None = None

    geschmacksintensitaet: int
    frische: int
    suesse: int
    saeure: int
    bitterkeit: int
    schaerfe: int
    umami: int
    zitronig: int
    anisartig: int
    menthol: int
    harzig: int
    erdig: int
    blumig: int
    pfeffrig: int
    knoblauchartig: int

    licht: str | None = None
    bodenfeuchte: str | None = None
    bodenanspruch: str | None = None
    wasserbedarf: str | None = None
    naehrstoffbedarf: str | None = None
    hoehe: str | None = None

    standort_eignung: int | None = None
    lebensdauer: str
    anbau_typ: str
    schwierigkeitsgrad: str | None = None
    giftige_teile: str | None = None

    tags: PlantTags = PlantTags()
    relationen: PlantRelations = PlantRelations()
    kalender: PlantCalendarGrouped = PlantCalendarGrouped()


class CalendarActivityItem(BaseModel):
    pflanzen_id: str
    pflanze_name: str
    pflanze_slug: str
    kategorie: str
    aktivitaet: str
    phase_von: int | None = None
    phase_bis: int | None = None
    laufend: bool
    hinweis: str | None = None


class MonthCalendar(BaseModel):
    monat: int
    aktive_phasen: list[int] = []
    eintraege: list[CalendarActivityItem] = []


class PhaenophaseItem(BaseModel):
    """Referenzdaten Phänophase → Monatsspanne (für die 12-Monats-Timeline)."""

    phase_id: int
    phase_name: str
    ref_monat_von: int
    ref_monat_bis: int
    model_config = {"from_attributes": True}


class PlantSpotlight(BaseModel):
    """Kraut des Monats. Teaser = typische_verwendung (beschreibungstext ist DB-weit leer)."""

    period_key: str
    slug: str
    deutscher_name: str
    botanischer_name: str | None = None
    teaser: str | None = None
