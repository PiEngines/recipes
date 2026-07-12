from pydantic import BaseModel


class PlantListItem(BaseModel):
    id: str
    slug: str
    deutscher_name: str
    botanischer_name: str | None = None
    hauptkategorie: str | None = None
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


class PlantDetail(PlantListItem):
    botanische_familie: str | None = None
    weitere_kategorien: str | None = None
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
