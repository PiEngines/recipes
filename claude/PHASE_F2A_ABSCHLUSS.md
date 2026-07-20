# PHASE F2a — ABSCHLUSS · Garten (Mein Beet + Kalender)

Stand: **live deployed & verifiziert** · 20.07.2026 · `origin/main @ 9486252` · Alembic-Head **0034** · Ablage: `claude/PHASE_F2A_ABSCHLUSS.md`

## 1 · Commits
| Commit | Hash | Inhalt |
|---|---|---|
| G1 | `30e1d7a` | Task-Ableitung + Erledigt-Status (`user_plant_task_done`, `/api/garden/tasks`, Toggle) |
| G2 | `a7215c3` | Mein Beet · Segment BEET (flache Liste, Phase-Badge) |
| G3 | `9486252` | Segment KALENDER (Saison + Arbeit) |

Deploy = Backend + Migration 0034 (`docker compose run --rm backend alembic upgrade head` vor `up -d`).

## 2 · Neu (Verträge / Gotchas)
- Modell `user_plant_task_done` (`user_plant_id`, `task_key`, `period_key`, unique) — Erledigt-Status je Aufgabe **je Periode**. `task_key` trägt das **Phasenfenster** (z. B. `rueckschnitt-p5-p5`), damit dieselbe Aktivität mit verschiedenen Fenstern nicht kollabiert.
- Endpoints `/api/garden`: `GET /tasks?scope=month`, `POST|DELETE /tasks/{user_plant_id}/{task_key}/done`, `PATCH /beet/{plant_slug}` (`planted_on`). Abhaken **validiert `task_key` gegen die abgeleiteten, abhakbaren Aufgaben** (kein Schreiben beliebiger Keys; 404 bei Status-/Fremdeinträgen).
- **Aufgaben werden abgeleitet** (kein Aufgaben-Content): aus `planted_on` + `plant_calendar` (+ `/api/plants/phases` für Monatsauflösung). Phasennamen aus der geladenen phase_map (nicht per ORM-getattr — das war ein von CCs Test gefangener Bug).
- **`BeetItem` additiv** um `user_plant_id` + `phase_badge` erweitert; F1-Felder unverändert (verifiziert).
- Frontend: `Garten.jsx` (Mein Beet), `GartenKalender.jsx`, `theme/gardenTasks.js`, API in `api/plants.js`. Task-State in `Garten.jsx` (geteilt → Haken im Kalender aktualisiert sofort den Beet-Hinweis). **Bottom-Nav „Garten" → `/garten`** (löst F1-Interim ab).

## 3 · Regeln (Lead-entschieden)
- **Abhakbar = Whitelist von Handlungen:** Aussaat/Säen, Direktsaat, Vorkultur, Pflanzung, Rückschnitt, Winterschutz, Teilung. Alles andere (Ernte, **Blüte**, laufende/beschreibende Einträge) → **Status, keine Checkbox**.
- **Phase-Badge:** aktueller Monat vs. Kalender → AUSSAAT · WÄCHST · ERNTE.

## 4 · Bewusst weggelassen → Merkliste
- **Standort & Anzahl** (kein Ort-Management; Mein Beet = flache Liste; Licht steht im Steckbrief).
- **Wochen-Linse** (`scope=week` → 422; Kalenderdaten sind nur monatsscharf).
- **Erinnerungen/Push** (Task-Engine Stufe c).
- **„Passend jetzt kochen"** (Saison-Rezepte, braucht Rezept↔Beet-Matching + echte Rezepte).

## 5 · Verifikation (Lead)
- **Statisch:** Kette linear; `BeetItem` additiv; `PlantDetail` unverändert.
- **Migration 0034:** gegen echtes Postgres 16 — upgrade bis 0034, `user_plant_task_done` entsteht, downgrade 0033 entfernt, re-upgrade reversibel.
- **Live (Browser):** Mein Beet flach + Phase-Badge (ERNTE); Segment BEET·KALENDER; SAISON „Erntereif im Juli"; ARBEIT gruppiert; **Buschbohne · Aussaat abgehakt → über echten Reload persistent**; Blüte/Ernte korrekt nur Status.
- **Datenlage:** nur 594/1744 Kalenderzeilen haben `hinweis`; sonst Aktivitäts-Label. Aufgabenliste wirkt nüchterner als Prototyp → Content-Ticket.
