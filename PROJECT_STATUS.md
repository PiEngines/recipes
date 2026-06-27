# PROJECT_STATUS.md
> Letzte Aktualisierung: 2026-06-27
> Zweck: Session-Starterpaket für neue Claude-Threads. Immer als erstes mitgeben.

---

## Stack (Kurzreferenz)
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL 16
- **Frontend:** React, Vite, Tailwind
- **Infra:** Docker Compose, Caddy, Raspberry Pi 5, Cloudflare Tunnel
- **Dev:** Lokal Windows (`D:\engines\recipes`), Deploy via GitHub → Pi
- **Tests:** `docker compose exec backend python -m pytest tests/ -v`

## Claude-Zugriff auf den Code

Claude (claude.ai) kann den Code direkt via Browser-Plugin lesen:
- Tool: "Claude in Chrome" (Browser-Plugin, muss verbunden sein)
- Methode: `get_page_text` auf GitHub-Seiten liefert echten Text, kein Bild
- Repo: https://github.com/PiEngines/recipes
- Workflow: Claude navigiert selbst zu Dateien und liest sie — kein CC als Zwischenstufe für Analysen nötig

Voraussetzung: Browser mit GitHub-Tab offen und Plugin aktiv.
Zu Beginn jedes Threads: Claude via `tabs_context_mcp` prüfen ob Browser verbunden ist.

---

## Aktueller Stand

### ✅ Implementiert (verifiziert im Repo, Stand 2026-06-24)

| Bereich | Details | Letzter Commit |
|---|---|---|
| Migrationen 0001–0021 | Initial bis `add_module_fields` | heute |
| Modul-System | Migration, Backend, API, Frontend – 68 Tests grün | heute |
| pytest im Container | `requirements-dev.txt` + Dockerfile DEV-Stage | heute |
| RecipeForm | Toggle Kochen/Backen, Gruppen-UX, Modul-Toggle, Auslagern-Button | heute |
| Rezept-Typ Badge | Karte + Detailseite + Formular | vor 2 Wochen |
| Ingredient Matching | Pipeline + Review-Flow (0016) | vor 2 Wochen |
| Seasonal Tags | Migration 0019 | vor 2 Wochen |
| User Favorites / History / Comments | Migration 0015 | vor 2 Wochen |
| Auth / Rollen / Einladungen | Migrationen 0007–0013 | letzten Monat |
| Media Upload | Migration 0004, MediaUpload.jsx | letzten Monat |
| Soft Delete Rezepte | Migration 0014 | letzten Monat |
| Admin Dashboard | AdminDashboard, AdminRecipes, AdminUsers | vor 2 Wochen |
| Herzchen Light-Mode Fix | FavoriteHeart.jsx — var(--text) für outline-Zustand + Drop-Shadow | 2026-06-25 |
| Entwurf-Status entfernt | Migration 0022, Backend (RecipeStatus.draft, toggle_status) + Frontend (Badge, Button, Status-Anzeigen in Recipes.jsx, RecipeForm.jsx, Profile.jsx, AdminRecipes.jsx) vollständig entfernt | 2026-06-25 |
| Chefkoch Modul-Override | modules/router.py — _check_recipe_access bei einbinden/auslagern/entfernen: Chefkoch/Küchenchef zusätzlich zum Owner erlaubt | 2026-06-25 |

#### Modul-System – Architektur-Entscheidungen (zur Referenz)
- **Modell:** Snapshot-Referenz, kein Fork. 1000 Einbindungen = 1000 Referenzen auf denselben Snapshot
- **Einbinden:** immer ganzes Rezept, keine Teilgruppen (V1)
- **Auslagern:** Button auf Gruppe → Gruppe wird automatisch durch Modul-Referenz ersetzt
- **Zusätzliche Zutaten:** manuelle Zutaten zusätzlich in Modul-Gruppe erlaubt
- **Schritte:** als Block anhängen, Präfix `"{component_label}: Schritt {n}"` nur bei Modul-Schritten
- **Skalierung:** `modul_menge * hauptrezept_portionen / modul_portionen`; `servings_override` + `scale_factor` als Overrides
- **Nicht-parsbare Mengen:** unverändert übernehmen
- **Zirkelreferenz:** rekursive CTE, HTTP 400 mit deutscher Fehlermeldung

---

### 🔲 Offen – Formular-UX (Konzept fertig, nicht implementiert)

| Task | Priorität | Aufwand | Notiz |
|---|---|---|---|
| Mobile: Übersichtsscreen mit thematischen Blöcken | Hoch | Groß | Separate Screens pro Block |
| Mobile: Eigener Fertig-Button + Zurück pro Block | Hoch | Mittel | |
| Desktop: Erweiterte Felder eingeklappt hinter "Weitere Details" | Mittel | Mittel | Portionen + Art bleiben sichtbar |
| Expertenmodus-Toggle im Nutzerprofil | Mittel | Klein | |
| DB: `form_expert_mode BOOLEAN DEFAULT false` auf User-Tabelle | Mittel | Klein | Unklar ob in Migration 0006 enthalten – prüfen! |
| Zutaten-Block: Info-Icon + Tooltip | Niedrig | Klein | |
| Zutaten-Block: Immer mit 1 Gruppe öffnen, Gruppenname optional | Mittel | Klein | |
| Zutaten: Mengenfeld-Validierung | Mittel | Klein | Nur Frontend. Erlaubt: ganze Zahlen, Dezimalzahlen (0.5), Brüche (1/2, ¾), Bereiche (2-3). Alles andere ablehnen. Backend-Validierung nicht nötig solange kein direkter API-Zugriff. |

---

### 🔲 Offen — Redesign & neue Features (Design-Paket Juni 2026)

Design-Prototypen liegen unter `/design/*.dc.html`. Reihenfolge ist priorisiert.

| Task | Datei | Priorität | Notiz |
|---|---|---|---|
| GTM einbinden + DataLayer SPA-Fix | `frontend/index.html`, `frontend/src/main.jsx` | 🔴 Hoch | GTM-K2H9JG5J. DataLayer-Events laut CLAUDE.md. Vor allen anderen Redesign-Tasks. |
| Security: Medien-Upload Owner-Check | `backend/media/router.py` POST | 🔴 Hoch | Sicherheitslücke in Production. Fix laut CLAUDE.md Security-Abschnitt. |
| Security: Caddy Security-Header | `caddy/Caddyfile` | 🔴 Hoch | Header + sensible Pfade blockieren laut CLAUDE.md. |
| Design Tokens in index.css | `frontend/src/index.css` | 🔴 Hoch | @theme-Block mit neuen Tokens. Voraussetzung für alle weiteren Redesign-Tasks. |
| Design-Prototypen ins Repo | `/design/` (neuer Ordner) | 🔴 Hoch | *.dc.html + support.js aus Übergabe-Paket. |
| Startseite Redesign | `pages/Home.jsx` | 🟡 Mittel | Mobile + Desktop. Karussell, Fratcher-Teaser, Entdecken-Feed 2→3 Spalten Desktop, Infinite Scroll. |
| Suchergebnisseite Redesign | `pages/Recipes.jsx` | 🟡 Mittel | Desktop Left Sidebar Filter, aktive Filter als Chips. |
| Detailseite Redesign | `pages/RecipeDetail.jsx` | 🟡 Mittel | Hero-Galerie, Schritt↔Zutat-Highlight, Portionen-Skalierung Pull-Tab (Mobile), Sidebar (Desktop). |
| RecipeForm Redesign + Wizard | `pages/RecipeForm.jsx` | 🟡 Mittel | 5-Schritt-Wizard Mobile, Stepper-Layout Desktop, Auto-Save, Freigabe-Sheet. |
| Fratcher (neu) | `pages/Fratcher.jsx` (neu anlegen) | 🟡 Mittel | Kühlschrank-Matcher. Mobile Bottom-Sheet, Desktop 2-Panel. |
| AdminUsers.jsx Frontend-Guards | `pages/AdminUsers.jsx` | 🟡 Mittel | Rollen-Dropdown, Delete, Restore für Chefkoch verstecken. |
| Drag & Drop Schritte | `pages/RecipeForm.jsx` | 🟠 Niedrig | Standard DnD-Library. Voraussetzung: RecipeForm Wizard fertig. |
| Kräuterschule-Seite | `pages/Herbs.jsx` (neu) | 🟠 Niedrig | Kein Design vorhanden — erst nach Rücksprache. |

---

### ⏸ Geparkt (bewusst zurückgestellt)

| Task | Notiz |
|---|---|
| Drag & Drop für Schritte | Voraussetzung für freie Modul-Schritt-Sortierung |
| Foto-Upload vor erstem Speichern | Technische Lösung ausstehend |
| Modul-System: Einzelne Gruppe direkt einbinden | Aktuell muss Gruppe erst ausgelagert werden. Später: direkt referenzieren ohne Auslagern |
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
