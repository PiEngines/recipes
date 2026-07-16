# Entscheidungs-Log — Redesign-Thread (Kräuterschule/Recipes)
> Kanonisches Log. „verifiziert" = Code-Prüfung gegen `main`. Legende: 🔒 gelockt · 👤 bestätigt · 🔄 reversibel · ⏸ vertagt.

## Entscheidungen
| # | Entscheidung | Begründung | Status |
|---|---|---|---|
| 1 | Lead plant/verifiziert/brieft, CC führt aus. | CC hat Umgebung; Lead nur Lesezugriff auf `main`. | 🔒 |
| 2 | Backend-Prep (Phase A) vor Frontend. | Detail = riskantester Schritt; Phase A entblockt Home/Kategorie. | 🔒 |
| 3 | Phase-A-Scope: genau 3 Adds. | Saubere Scheibe. | 🔒 |
| 4 | `primary_image` aus `media` (Thumbnail), nicht totem `recipe_images`. | `recipe_images` wird nirgends geschrieben → Bindung lieferte null. Lead-Miss, korrigiert. | 🔒 verifiziert |
| 5 | serve-with-Karte minimal (nur Titel). | Endpoint liefert nur `{id,title}`. | ⏸·🔄 |
| 6 | `FeedCard` → eine kanonische `RecipeCard`. | Keine Duplizierung; FeedCard bleibt bis Phase D. | 🔒 |
| 7 | Frontend in Scheiben statt Mega-Commit. | Prüfbare Slices. | 🔒 |
| 8 | Detail-Reskin: reskin-in-place. | Logik isoliert von Präsentation. | 👤·🔒 |
| 9 | B1b Home: chirurgischer Reskin. | Prototyp-Hero bindet an nicht existentes `featured[]`. | 👤·🔒 verifiziert |
| 10 | Hero nutzt Thumbnail (`primary_image`). | Volle N+1-Entfernung. | 🔄 |
| 11 | Hero-Karussell-Merkeintrag unter „Features/UX — Merkliste". | Kein „Migration"-Abschnitt vorhanden. | 🔒 minor |
| 12 | B1c Kategorie: vertagt, zügig nachziehen. | 3-fach blockiert (Backend/`category`-Wiring/Nav-Heimat). | 👤·⏸ |
| 13 | Detail-Tab-Umbau NICHT gebaut. | UX-Regression (Zutaten weg) + sensible Logik. | 🔄·⏸ |
| 14 | Filter Multi-Select: OR innerhalb Facette, AND über Facetten. | Standard-Facettensuche. | 🔄 |
| 15 | Allergene = Ausschlussfilter. | „ohne Nüsse" ist der reale Use-Case. | 🔒 |
| 16 | Facet-Counts vertagt auf C1b. | Komplex; Filter unblocken Phase D auch ohne. | ⏸ |
| 17 | Rating (C2) Defaults: 5 Sterne, 1/User editier-/löschbar, kein Self-Rating, avg+count. | Standard, missbrauchsarm. | 🔄 Defaults, Veto offen |

## Offene technische Punkte
- `Recipes.jsx` sendet `order_by=created_at` statt `sort` → Home-`?sort=newest`-Links greifen nicht durch (Phase-D-Alignment).
- `recipe_images` Legacy (tote Tabelle + `RecipeResponse.images`) — Cleanup-Ticket.
- `type`-Param nicht auf `list` migriert (bleibt comma-`str`).

## Arbeitsweise
1. Ein Handover = mehrere geordnete Commits, je Self-Check; User reicht einmal an CC, Lead verifiziert den Stapel einmal.
2. Lead entscheidet + loggt; Pause nur bei echten Forks.
3. Docs/Merkliste fließen in denselben Handover.
4. Verifikation gegen `main` bleibt Pflicht.

## Verifikations-Trail (grün)
| Scheibe | Commit(s) |
|---|---|
| Phase A | `424ad64`,`71b5495`,`08489b1` |
| Phase A.1 | `bf43d28`,`8963c3e` |
| B1a RecipeCard | `4ecf428` |
| B1b Home | `e0ae05e`,`1fe97fb` |
| Detail-Politur | `299d192`,`3fbd558` |
