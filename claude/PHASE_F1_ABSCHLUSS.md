# PHASE F1 — ABSCHLUSS · Kräuterschule + Pflanzen-Detail

Stand: **live deployed & verifiziert** · 20.07.2026 · `origin/main @ 33686d3` · Alembic-Head **0033** · Ablage: `claude/PHASE_F1_ABSCHLUSS.md`
Zweck: As-built-Referenz von F1 für den nächsten Lead-Thread. Ersetzt den Handover-Entwurf (`CC_HANDOVER_F1.md`) als kanonischen Stand.

## 1 · Commits (alle auf origin/main)

| Commit | Hash | Inhalt |
|---|---|---|
| Asset | `b3cd9b0` | `plant-placeholder.svg` → `frontend/src/assets/` |
| B1 | `2b09878` | Beet-Fundament: `user_plants` + `/api/garden` |
| B2 | `3784e40` | Spotlight (`plant_spotlight_history`) + `/api/plants/spotlight` + `/api/plants/phases` |
| U1 | `ab75ea1` | Kräuterschule-Übersicht + Plants-API-Client |
| U2 | `d369452` | Pflanzen-Detail (Steckbrief/Anbau/Rezepte) |
| N1 | `02ac670` | `weitere_kategorien` additiv in `PlantListItem` |
| N2 | `33686d3` | Regal-Mapping (`plantShelves.js`) statt roher `hauptkategorie` |

**Live-Anker:** Code `33686d3` · DB `0033`. Deploy F1 war **Backend + Migration** (nicht Frontend-only): `git pull` → `docker compose build backend frontend` → `docker compose run --rm backend alembic upgrade head` → `docker compose up -d backend frontend`.

## 2 · Was neu ist (Verträge / Gotchas)

**Backend**
- Modell `user_plants` (User↔Pflanze, `planted_on`, `created_at`, unique(user,plant)). Router `/api/garden`: hinzufügen (idempotent, `planted_on=heute`) / entfernen / meine Liste.
- Modell `plant_spotlight_history` (plant_id, `period_key="YYYY-MM"`, unique(period_key)). `GET /api/plants/spotlight`: stabiler Monats-Pick, **Cooldown 12 Monate**, Pool saisonal→Fallback alle, IntegrityError→re-read.
- `GET /api/plants/phases`: 10 Phänophasen mit `ref_monat_von/bis` (Frontend mappt Phase→Monat für die Timeline).
- `PlantListItem` um `weitere_kategorien` erweitert (**additiv**, optional). `PlantDetail`-Vertrag **unverändert** (redundante Deklaration entfernt; `model_json_schema()` byte-identisch verifiziert).
- Bereits vorhanden & genutzt: `GET /api/plants/{slug}/recipes`, `GET /api/plants/calendar`.

**Frontend**
- Routen: `/kraeuterschule` (Übersicht), `/pflanzen/:slug` (Detail). Plants-API-Client `src/api/plants.js`.
- `theme/plantShelves.js`: Regal-Zuordnung, bewusst **frei von React-/Asset-Importen** (Node-testbar). `theme/plants.js` importiert das Platzhalter-SVG (daher getrennt). `theme/plantCalendar.js`: Timeline-Helfer.
- `categoryColors.js`: die 5 Pflanzen-Gruppen existierten bereits; **nur Wildkräuter geändert** `#6E7A3A→#3E5B2A` (dark `#414A20→#243619`). Farbe kommt über `getCategoryColor(key)`, `Weitere` fällt bewusst auf `NEUTRAL_CATEGORY`.
- Foto überall = das eine Platzhalter-SVG (`bild_dateiname` bleibt ungenutzt). Beschreibung leer → Lorem-Fallback im UI (nicht in DB).

## 3 · Kategorie-Regale (Entscheidung, live)

Sechs Regale, Reihenfolge Küchenkräuter · Gemüse · Obst · Heilkräuter · Wildkräuter · Weitere. Zuordnung `hauptkategorie (21)` → Regal:
- **Küchenkräuter:** Küchenkraut, Gewürzpflanze
- **Gemüse:** alle *gemüse (Blatt/Frucht/Wurzel/Kohl/Zwiebel/Knollen/Stiel/Blüten) + Hülsenfrucht
- **Obst:** Obstpflanze, Wildobst
- **Wildkräuter:** Wildkraut
- **Heilkräuter (primär):** Teepflanze, Duftpflanze
- **Weitere:** Essbare Blütenpflanze, Nuss-, Genuss-, Süß-, Nutzpflanze

**Heilkräuter zusätzlich querschnittlich:** eine Pflanze kommt auch ins Heilkräuter-Regal, wenn `weitere_kategorien` ∈ {Heilpflanze, Teepflanze, Tee, Duftpflanze} → eine Pflanze kann in **zwei** Regalen stehen (z. B. Salbei in Küchenkräuter + Heilkräuter; Kachel-Punkt trägt die Farbe des jeweiligen Regals). Live-Verteilung: 101/103/19/46/35/16.

## 4 · Abweichungen vom Handover-Entwurf (dokumentiert)

- **Timeline-Quelle:** Ernte liegt in Daten unter `nutzung`, nicht `anbau`. Timeline = `anbau` (Aussaat/Direktsaat/Vorkultur→„Aussaat"; Pflanzung) **+ Ernte aus `nutzung`**, genau 3 Zeilen wie Prototyp. Teilung/Blüte/Rückschnitt/Pflege nur in den Hinweis-Karten.
- **Phase→Monat:** nicht in `PlantCalendarItem`, daher neuer Endpoint `GET /api/plants/phases` (statt Frontend-Konstante/Schema-Erweiterung).
- **Platzhalter-Asset:** lag nur beim Lead vor, nicht im Repo → als `b3cd9b0` eingecheckt (Formulierung „vom Lead geliefert" war irreführend).
- **categoryColors:** war **Wertänderung**, keine Ergänzung (Kategorien existierten bereits).

## 5 · Bewusst weggelassen (Abweichung, nicht „fixen" — siehe Merkliste)

- **Probleme-Tab** (Krankheiten/Schädlinge/Severity) — kein Modell/Content → Merkliste.
- **Sorten**-Sektion — kein Modell/Content → Merkliste.
- **Teilen-Button** im Hero — Social (F3).
- **„Alle →"** je Regal — kein Ziel definiert; stattdessen Anzahl-Badge → Merkliste.
- **Rezept-Zeile ohne Zeit** — `RecipeMatchItem` hat kein Zeit-Feld; Meta = Art · Autor → Merkliste.
- **Garten-Bottom-Nav → `/kraeuterschule`** (interim; in F2 → Mein Beet).
- **Beet-Fundament aus F2 vorgezogen** (bewusst F2-kompatibel; volle Mein-Beet-/Kalender-Seite bleibt F2).
- **Beschreibung = Lorem**, **Bild = ein Platzhalter-SVG** (Content-Tickets, Merkliste).

## 6 · Verifikation (Lead)

- **Statisch/Verträge:** Commit-Kette linear; `categoryColors.js` nur Wildkräuter-Zeile; `PlantListItem` nur additiv `weitere_kategorien` (required unverändert); `PlantDetail` JSON-Schema byte-identisch.
- **Migrationen 0032/0033:** gegen echtes Postgres 16 gefahren — `upgrade head` (ganze Kette) grün, `downgrade 0031` entfernt beide Tabellen, re-`upgrade` reversibel.
- **Live (Browser, Mike-Session):** Regal-Reihenfolge + Farben + Salbei 2×; Spotlight „Catalogna"; Detail 3 Tabs (kein Probleme); Giftwarnung prominent (Rhabarber, Oxalsäure); Beet-Toggle **persistent über Reload**, dann entfernt; ANBAU-Timeline 3 Zeilen mit Phase→Monat + „In deinem Beet"-Zeile; REZEPTE-Leerzustand.
- **Nur datenbedingt ungeprüft:** befüllte Rezept-Zeile — aktuell hat keine Pflanze verknüpfte Rezepte (kaum echte Rezepte in prod). Kein Code-Fehler → Merkliste.
