import csv
import logging
import re
from pathlib import Path

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Phaenophase, Plant, PlantRelation, PlantTag

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "plants"

_QUALIFIER_RE = re.compile(r"^(?P<name>.+?)\s+(?P<qual>(nur\s.+|eingeschränkt|nicht direkt))$")

TASTE_FIELDS = [
    "geschmacksintensitaet", "frische", "suesse", "saeure", "bitterkeit",
    "schaerfe", "umami", "zitronig", "anisartig", "menthol",
    "harzig", "erdig", "blumig", "pfeffrig", "knoblauchartig",
]

# Leerer String -> None (alle nullable Text-Spalten in plants.csv)
NULLABLE_TEXT_FIELDS = [
    "botanischer_name", "botanische_familie", "hauptkategorie", "weitere_kategorien",
    "synonyme", "quelle_botanik", "typische_verwendung", "licht", "bodenfeuchte",
    "bodenanspruch", "wasserbedarf", "naehrstoffbedarf", "hoehe",
    "bild_dateiname", "beschreibungstext", "giftige_teile", "warnung", "schwierigkeitsgrad",
]

UPDATE_FIELDS = [
    "deutscher_name", "botanischer_name", "botanische_familie", "hauptkategorie",
    "weitere_kategorien", "synonyme", "quelle_botanik", "typische_verwendung",
    "licht", "bodenfeuchte", "bodenanspruch", "wasserbedarf", "naehrstoffbedarf", "hoehe",
    *TASTE_FIELDS,
    "standort_eignung", "lebensdauer", "anbau_typ", "schwierigkeitsgrad",
]


def _plant_fields_from_row(row: dict) -> dict:
    fields = {k: (v or None) if k in NULLABLE_TEXT_FIELDS else v for k, v in row.items() if k != "id"}
    for field in TASTE_FIELDS:
        fields[field] = int(row[field])
    fields["standort_eignung"] = int(row["standort_eignung"])
    return fields


def seed_phaenophasen(db: Session) -> tuple[int, int]:
    inserted = updated = 0
    with open(DATA_DIR / "phaenophasen.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            phase_id = int(row["phase_id"])
            phase = db.get(Phaenophase, phase_id)
            if phase is None:
                phase = Phaenophase(phase_id=phase_id)
                db.add(phase)
                inserted += 1
            else:
                updated += 1
            phase.phase_name = row["phase_name"]
            phase.zeigerpflanze = row["zeigerpflanze"] or None
            phase.ref_monat_von = int(row["ref_monat_von"])
            phase.ref_monat_bis = int(row["ref_monat_bis"])
    return inserted, updated


def seed_plants(db: Session) -> tuple[int, int]:
    inserted = updated = 0
    with open(DATA_DIR / "plants.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            plant_id = row["id"]
            fields = _plant_fields_from_row(row)
            plant = db.get(Plant, plant_id)
            if plant is None:
                # redaktion_freigegeben bewusst nicht gesetzt -> DB-Default false
                plant = Plant(id=plant_id, **fields)
                db.add(plant)
                inserted += 1
            else:
                for name in UPDATE_FIELDS:
                    setattr(plant, name, fields[name])
                updated += 1
    return inserted, updated


def seed_plant_tags(db: Session) -> int:
    db.query(PlantTag).delete()
    count = 0
    with open(DATA_DIR / "pflanzen_tags.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            db.add(PlantTag(
                pflanzen_id=row["pflanzen_id"],
                facet=row["facet"],
                canonical=row["canonical"],
                ist_stil=(row["ist_stil"] == "1"),
            ))
            count += 1
    return count


def seed_plant_relations(db: Session) -> int:
    db.query(PlantRelation).delete()
    count = 0
    with open(DATA_DIR / "pflanzen_relationen.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ziel_typ = row["ziel_typ"]
            qualifier = row["qualifier"] or None
            if ziel_typ == "pflanze":
                ziel_pflanze_id = row["ziel_id"] or None
                ziel_name = None                      # CHECK: pflanze => ziel_name NULL
            else:
                ziel_pflanze_id = None
                ziel_name = row["ziel_name"] or None
                if ziel_typ == "zutat" and qualifier is None and ziel_name:
                    m = _QUALIFIER_RE.match(ziel_name)   # B-Normalisierung, nur zutat
                    if m:
                        ziel_name = m.group("name")
                        qualifier = m.group("qual")
            db.add(PlantRelation(
                pflanzen_id=row["pflanzen_id"],
                beziehung=row["beziehung"],
                ziel_typ=ziel_typ,
                ziel_pflanze_id=ziel_pflanze_id,
                ziel_name=ziel_name,
                qualifier=qualifier,
            ))
            count += 1
    return count


def seed_plant_data() -> None:
    db: Session = SessionLocal()
    try:
        phaeno_inserted, phaeno_updated = seed_phaenophasen(db)
        plant_inserted, plant_updated = seed_plants(db)
        tags_count = seed_plant_tags(db)
        relations_count = seed_plant_relations(db)
        db.commit()
        logger.info("phaenophasen: %d inserted, %d updated", phaeno_inserted, phaeno_updated)
        logger.info("plants: %d inserted, %d updated", plant_inserted, plant_updated)
        logger.info("plant_tags: %d reloaded", tags_count)
        logger.info("plant_relations: %d reloaded", relations_count)
    except ProgrammingError:
        db.rollback()
        logger.info("Seed skipped — Tabellen noch nicht da (erst migrieren)")
    except Exception:
        db.rollback()
        logger.exception("Failed to seed plant data")
    finally:
        db.close()


if __name__ == "__main__":
    seed_plant_data()
