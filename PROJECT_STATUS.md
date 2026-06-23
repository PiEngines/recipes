# PROJECT_STATUS.md
> Letzte Aktualisierung: 2026-06-23
> Zweck: Session-Starterpaket für neue Claude-Threads. Immer als erstes mitgeben.

---

## Stack (Kurzreferenz)
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL 16
- **Frontend:** React, Vite, Tailwind
- **Infra:** Docker Compose, Caddy, Raspberry Pi 5, Cloudflare Tunnel
- **Dev:** Lokal Windows (`D:\engines\recipes`), Deploy via GitHub → Pi

---

## Aktueller Stand

### ✅ Implementiert (verifiziert im Repo, Stand 2026-06-23)

| Bereich | Details | Letzter Commit |
|---|---|---|
| Migrationen 0001–0020 | Initial bis `add_recipe_type` | vor 2 Wochen |
| RecipeForm | Toggle Kochen/Backen als Pflichtfeld | vor 2 Wochen |
| Rezept-Typ Badge | Karte + Detailseite + Formular | vor 2 Wochen |
| Ingredient Matching | Pipeline + Review-Flow (0016) | vor 2 Wochen |
| Seasonal Tags | Migration 0019 | vor 2 Wochen |
| Thumbnail-Style | Migration 0017 | vor 2 Wochen |
| Step Unmatched Suggestions | Migration 0018 | vor 2 Wochen |
| User Favorites / History / Comments | Migration 0015 | vor 2 Wochen |
| Auth / Rollen / Einladungen | Migrationen 0007–0013 | letzten Monat |
| Media Upload | Migration 0004, MediaUpload.jsx | letzten Monat |
| Soft Delete Rezepte | Migration 0014 | letzten Monat |
| Admin Dashboard | AdminDashboard, AdminRecipes, AdminUsers | vor 2 Wochen |
| Favorites Fix | Unfav graut Kachel nicht sofort | vor 2 Wochen |

---

### 🔲 Offen – Formular-UX (Konzept fertig, nicht implementiert)

| Task | Priorität | Aufwand | Notiz |
|---|---|---|---|
| Mobile: Übersichtsscreen mit thematischen Blöcken | Hoch | Groß | Separate Screens pro Block |
| Mobile: Eigener Fertig-Button + Zurück pro Block | Hoch | Mittel | |
| Desktop: Erweiterte Felder eingeklappt hinter "Weitere Details" | Mittel | Mittel | Portionen + Art bleiben sichtbar |
| Expertenmodus-Toggle im Nutzerprofil | Mittel | Klein | |
| DB: `form_expert_mode BOOLEAN DEFAULT false` auf User-Tabelle | Mittel | Klein | Unklar ob in Migration 0006 enthalten – prüfen! |
| Zutaten-Block: "Gruppe" statt "Komponente" (nur Frontend-Label) | Niedrig | Klein | DB-Spalte `component_label` bleibt |
| Zutaten-Block: Info-Icon + Tooltip | Niedrig | Klein | |
| Zutaten-Block: Immer mit 1 Gruppe öffnen, Gruppenname optional | Mittel | Klein | |

---

### 🔲 Offen – Modul-System (Konzept fertig, nicht implementiert)

#### Konzept-Entscheidungen (für Claude Code)

- **Modell:** Snapshot-Referenz, kein Fork. 1000 Einbindungen = 1000 Referenzen auf denselben Snapshot
- **Einbinden:** immer ganzes Rezept, keine Teilgruppen (V1)
- **Auslagern:** Button "Als eigenes Rezept auslagern" auf Gruppe → Gruppe wird im Original automatisch durch Modul-Referenz ersetzt
- **Zusätzliche Zutaten:** manuelle Zutaten zusätzlich in einer Modul-Gruppe erlaubt (Modul ergänzen, nicht ersetzen)
- **Schritte:** Modul-Schritte als Block anhängen, kein Mischen mit Hauptrezept-Schritten
- **Schritte-Präfix:** nur Modul-Schritte bekommen Gruppenname als Präfix ("BBQ-Sauce: Schritt 1"), Hauptrezept-Schritte bleiben nummeriert wie bisher
- **Skalierung:** `modul_menge * hauptrezept_portionen / modul_portionen`; Override A: `servings_override` (feste Portionszahl); Override B: `scale_factor` (Prozent-Eingabe im UI, Dezimalzahl im Backend, z.B. 80% → 0.8); wenn beide gesetzt: `servings_override` hat Vorrang, `scale_factor` wird zusätzlich angewendet
- **Nicht-parsbare Mengen** (`nach Geschmack`, `etwas`, `1 Prise`): unverändert übernehmen, kein Flag, keine Warnung
- **Bruch-Parsing:** Python `fractions.Fraction` + eigener String-Normalizer, keine externe Dependency
- **Zirkelreferenz:** rekursive CTE, direkt + indirekt; Fehlermeldung: "Dieses Rezept kann nicht eingebunden werden – es ist bereits Bestandteil dieses Rezepts."
- **Modul-Suche:** Freitext + Tag + Kategorie filterbar
- **Autor-Anzeige:** bei Fremdmodulen Original-Autor verlinken → Link zur Rezeptliste gefiltert nach diesem Autor
- **Rückverweise:** "Wird verwendet in X Rezepten" – nur COUNT, keine Liste

#### Implementierungs-Tasks

| Task | Priorität | Aufwand | Notiz |
|---|---|---|---|
| DB-Migration 0021: `recipe_components` + `servings_override` + `scale_factor` + `referenced_version_id` | Hoch | Klein | `scale_factor DECIMAL` neu hinzu |
| Backend: Zirkelreferenz-Prüfung (rekursive CTE) | Hoch | Mittel | Direkt + indirekt |
| Backend: Bruch-Parsing (`fractions.Fraction` + String-Normalizer) | Hoch | Mittel | Keine externe Dependency |
| Backend: Portionsskalierung inkl. beide Overrides | Hoch | Mittel | Im Backend, nicht Frontend |
| Backend: Snapshot beim Einbinden (RecipeVersion) | Hoch | Mittel | Nicht beim Speichern des Hauptrezepts |
| Backend: "Als eigenes Rezept auslagern" Endpunkt | Mittel | Mittel | Gruppe → eigenes Rezept + automatisch Modul-Referenz im Original |
| API: `POST /api/recipes/:id/components` | Hoch | Mittel | Modul einbinden + Snapshot erstellen |
| API: `GET /api/recipes/:id/used-in` | Niedrig | Klein | Nur COUNT zurückgeben |
| API: `GET /api/recipes/search?as_module=true` | Mittel | Klein | Filter: Freitext + Tag + Kategorie |
| API: `GET /api/recipes/:id` erweitern | Hoch | Mittel | Snapshots auflösen + Skalierung anwenden |
| Frontend: Modul-Toggle in Zutaten-Gruppe | Mittel | Groß | Dropdown mit Freitext + Tag + Kategorie + Portionen-Override + scale_factor |
| Frontend: "Als eigenes Rezept auslagern"-Button auf Gruppe | Mittel | Mittel | |
| Frontend: Modul-Zutaten + Schritte in Detailansicht | Mittel | Mittel | Schritte mit Gruppenname-Präfix |
| Frontend: Autor-Link bei Fremdmodulen | Niedrig | Klein | Link → Rezeptliste gefiltert nach Autor |
| Frontend: "Wird verwendet in X Rezepten" in Detailansicht | Niedrig | Klein | Nur Zahl, keine Liste |

---

### ⏸ Geparkt (bewusst zurückgestellt)

| Task | Notiz |
|---|---|
| Entwurf-Status abschaffen | Auswirkung auf Modulberechtigung erst klären |
| Drag & Drop für Schritte | Voraussetzung für freie Modul-Schritt-Sortierung |
| Foto-Upload vor erstem Speichern | Technische Lösung ausstehend |
| Herzchen-Bug auf RDP | Favs-Context-Update, keine Bilder bei Favs |
| Modul-System: Einzelne Gruppe direkt einbinden | Aktuell muss Gruppe erst als eigenes Rezept ausgelagert werden. Später: Gruppe direkt als Modul referenzieren ohne Auslagern |
| Modul-System: Varianten-Gruppierung im Dropdown | Varianten desselben Rezepts gruppiert anzeigen – erst relevant wenn Fremdrezepte als Module häufig genutzt werden |

---

## Konventionen (für neue Sessions)

- **data-track-id Schema:** `{seite}-{element}-{aktion}` – alle neuen Komponenten bekommen dieses Attribut
- **PowerShell:** kein `-Recurse` bei `Select-String`, stattdessen `Get-ChildItem ... | Select-String`
- **PowerShell-Befehle:** immer einzeilig ausgeben (`;` als Trenner), sodass sie direkt einfügbar sind – nie mehrzeilig
- **Saubere Lösungen vor schnellen Lösungen**
- **Keine Änderungen außerhalb des Aufgabenscopes**
- **Deploy-Befehle:** immer vollständig (lokal UND Pi, am Stück kopierbar)
- **Plattform:** bei Wechsel zwischen Pi/Lokal immer explizit kennzeichnen
- **Vor größeren Teilen:** Umfang einschätzen, ggf. in a/b/c aufbrechen
- **Fragen immer nummerieren**
