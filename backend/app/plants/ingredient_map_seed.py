"""Kräuterschule Phase 4 – Seed für plant_ingredient_map (Hybrid).

Ablauf (Full-Reload, idempotent – Doc-Konvention für Ableitungstabellen):

1. VOKAB-Tokens aufbauen: alle kanonischen Zutaten aus vokabular_zutaten.csv,
   jeweils synonym-expandiert (canonical_tokens). Das ist das Gate "was gilt
   ueberhaupt als (Koch-)Zutat".
2. Ableiten: pro Pflanze deutscher_name + synonyme synonym-expandieren und mit
   den VOKAB-Tokens schneiden. Nichtleere Schnittmenge => Pflanze IST eine Zutat
   => diese Tokens werden gespeichert (quelle='derived').
3. Override-CSV anwenden (plant_ingredient_overrides.csv): gezielte add/remove
   je Pflanzen-slug (quelle='override' fuer hinzugefuegte Tokens).
4. Tabelle leeren und neu befuellen.

Aufruf:
  - automatisch im lifespan (siehe main.py-Wiring), nach seed_plant_data()
  - manuell:  python -m app.plants.ingredient_map_seed
"""
import csv
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Plant
from app.models.plant_ingredient_map import PlantIngredientMap
from app.plants.ingredient_resolver import canonical_tokens

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "plants"
VOKAB_CSV = DATA_DIR / "vokabular_zutaten.csv"
OVERRIDES_CSV = DATA_DIR / "plant_ingredient_overrides.csv"

# synonyme-Feld ist Freitext; auf gaengigen Trennern splitten.
_SYN_SPLIT = str.maketrans({";": ",", "/": ",", "|": ","})


def _split_synonyms(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.translate(_SYN_SPLIT).split(",") if part.strip()]


def _load_vokab_tokens() -> set[str]:
    """Synonym-expandierte Token-Menge aller kanonischen Koch-Zutaten."""
    tokens: set[str] = set()
    with open(VOKAB_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            tokens |= canonical_tokens(row["canonical"])
    return tokens


def _derive_plant_tokens(db: Session, vokab_tokens: set[str]) -> dict[str, set[str]]:
    """pflanzen_id -> Menge kanonischer Tokens, die auch echte Zutaten sind."""
    result: dict[str, set[str]] = {}
    for plant in db.query(Plant).all():
        source_names = [plant.deutscher_name, *_split_synonyms(plant.synonyme)]
        plant_tokens: set[str] = set()
        for name in source_names:
            plant_tokens |= canonical_tokens(name)
        matched = plant_tokens & vokab_tokens
        if matched:
            result[plant.id] = matched
    return result


def _apply_overrides(db: Session, derived: dict[str, set[str]]) -> set[tuple[str, str]]:
    """Wendet add/remove aus der Override-CSV an.

    Rueckgabe: Menge (pflanzen_id, token), die durch ein 'add' hinzugekommen sind
    (fuer quelle='override'-Kennzeichnung). remove entfernt Tokens aus derived.
    """
    override_added: set[tuple[str, str]] = set()
    if not OVERRIDES_CSV.exists():
        return override_added

    slug_to_id = {slug: pid for pid, slug in db.query(Plant.id, Plant.slug).all()}

    with open(OVERRIDES_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            aktion = (row.get("aktion") or "").strip().lower()
            if aktion not in ("add", "remove"):
                continue  # Kommentar-/Beispielzeilen werden ignoriert
            slug = (row.get("slug") or "").strip()
            zutat = (row.get("zutat") or "").strip()
            pid = slug_to_id.get(slug)
            if pid is None:
                logger.warning("Override uebersprungen: slug '%s' nicht gefunden", slug)
                continue
            tokens = canonical_tokens(zutat)
            if not tokens:
                continue
            bucket = derived.setdefault(pid, set())
            if aktion == "add":
                for t in tokens:
                    bucket.add(t)
                    override_added.add((pid, t))
            else:  # remove
                bucket -= tokens
                override_added -= {(pid, t) for t in tokens}
    return override_added


def seed_plant_ingredient_map(db: Session | None = None) -> int:
    """(Neu-)Befuellt plant_ingredient_map. Gibt die Zahl geschriebener Zeilen zurueck."""
    own_session = db is None
    db = db or SessionLocal()
    try:
        vokab_tokens = _load_vokab_tokens()
        derived = _derive_plant_tokens(db, vokab_tokens)
        override_added = _apply_overrides(db, derived)

        db.query(PlantIngredientMap).delete()
        rows = 0
        for pid, tokens in derived.items():
            for token in sorted(tokens):
                quelle = "override" if (pid, token) in override_added else "derived"
                db.add(PlantIngredientMap(pflanzen_id=pid, token=token, quelle=quelle))
                rows += 1
        db.commit()
        logger.info(
            "plant_ingredient_map: %d Zeilen fuer %d Pflanzen (Full-Reload)",
            rows, len(derived),
        )
        return rows
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_plant_ingredient_map()
