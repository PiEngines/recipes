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

| Task | Priorität | Aufwand | Notiz |
|---|---|---|---|
| DB-Migration: `recipe_components` + `servings_override` + `referenced_version_id` | Hoch | Klein | Nächste wäre 0021 |
| Backend: Zirkelreferenz-Prüfung (rekursive CTE PostgreSQL) | Hoch | Mittel | Direkt + indirekt |
| Backend: Ingredient `amount` Bruch-Parsing (z.B. `1/2`) | Hoch | Mittel | Bibliothek oder eigene Logik |
| Backend: Portionsskalierung (`modul_menge * hauptrezept / modul_portionen`) | Hoch | Mittel | Skalierung im Backend, nicht Frontend |
| Backend: Snapshot beim Einbinden (RecipeVersion) | Hoch | Mittel | Nicht beim Speichern des Hauptrezepts |
| API: `POST /api/recipes/:id/components` | Hoch | Mittel | Modul einbinden + Snapshot |
| API: `GET /api/recipes/:id/used-in` | Niedrig | Klein | Nur COUNT zurückgeben |
| API: `GET /api/recipes/search?as_module=true` | Mittel | Klein | Nur einbindbare Rezepte |
| API: `GET /api/recipes/:id` erweitern | Hoch | Mittel | Snapshots auflösen + Skalierung |
| Frontend: Modul-Toggle in Zutaten-Gruppe | Mittel | Groß | Dropdown + Suche + Portionen-Override |
| Frontend: Modul-Zutaten + Schritte in Detailansicht | Mittel | Mittel | |
| Frontend: "Wird verwendet in X Rezepten" in Detailansicht | Niedrig | Klein | Nur Zahl, keine Liste |

---

### ⏸ Geparkt (bewusst zurückgestellt)

| Task | Notiz |
|---|---|
| Entwurf-Status abschaffen | Auswirkung auf Modulberechtigung erst klären |
| Drag & Drop für Schritte | Voraussetzung für freie Modul-Schritt-Sortierung |
| Foto-Upload vor erstem Speichern | Technische Lösung ausstehend |
| Herzchen-Bug auf RDP | Favs-Context-Update, keine Bilder bei Favs |

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
