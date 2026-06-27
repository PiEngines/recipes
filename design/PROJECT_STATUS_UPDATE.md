# PROJECT_STATUS.md — Update-Anweisung für Claude Code

## Aufgabe
Aktualisiere `PROJECT_STATUS.md` im Repo-Root mit den folgenden Änderungen.
Danach committen und pushen.

---

## 1. Kopfzeile aktualisieren
Alt: `Letzte Aktualisierung: 2026-06-24`
Neu: `Letzte Aktualisierung: 2026-06-27`

---

## 2. Unter ✅ Implementiert — folgende Zeilen hinzufügen

| Herzchen Light-Mode Fix | FavoriteHeart.jsx — var(--text) für outline-Zustand + Drop-Shadow | 2026-06-25 |
| Entwurf-Status entfernt | Migration 0022, Backend (RecipeStatus.draft, toggle_status) + Frontend (Badge, Button, Status-Anzeigen in Recipes.jsx, RecipeForm.jsx, Profile.jsx, AdminRecipes.jsx) vollständig entfernt | 2026-06-25 |
| Chefkoch Modul-Override | modules/router.py — _check_recipe_access bei einbinden/auslagern/entfernen: Chefkoch/Küchenchef zusätzlich zum Owner erlaubt | 2026-06-25 |

---

## 3. Unter ⏸ Geparkt — folgende Einträge ENTFERNEN
- `Entwurf-Status abschaffen` (erledigt)
- `Herzchen-Bug auf RDP` (erledigt)
- `Module: kein Chefkoch-Override` (erledigt)

---

## 4. Unter 🔲 Offen — neuen Abschnitt hinzufügen

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

## 5. Migrations-Referenz aktualisieren
Alt: `Letzte Migration: 0022_remove_draft_status.py`
Neu: `Letzte Migration: 0022_remove_draft_status.py` (unverändert, nächste wäre 0023)

---

## 6. Teststand aktualisieren
Alt: `Aktueller Teststand: 72/72 grün`
Neu: `Aktueller Teststand: 72/72 grün (Stand 2026-06-25)`

---

## Commit-Befehl (PowerShell, einzeilig):
```
cd D:\engines\recipes; git add CLAUDE.md PROJECT_STATUS.md; git commit -m "docs: CLAUDE.md GTM+Security+Standards, PROJECT_STATUS 2026-06-27"; git push
```

