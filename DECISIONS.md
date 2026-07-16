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
| 17 | Rating (C2) Defaults: 5 Sterne, 1/User editier-/löschbar, kein Self-Rating, avg+count. | Standard, missbrauchsarm. | 👤 bestätigt, gebaut |
| 18 | Recipes-Zeitfilter = nur max_time-Buckets (≤30/≤60). | min_time-Bereiche später. | 🔄 |
| 19 | Zero-Result-Facet-Diagnose → C3. | Braucht Facet-Counts. | ⏸ |
| 20 | Rating-Widget (D2): Platzierung Hauptspalte nach Author-/Meta-Block vor „Zubereitung" (Sidebar-Prototyp existiert live nicht → 260px-Zutaten-Sidebar bleibt); 5 SVG-Sterne `--accent`, interaktiv = ganze Sterne, Anzeige = Halbstern-Teilfüllung + „Ø x · n"; `my_stars` NICHT in Detail-Response → separater `GET …/rating` (User-Daten nicht an cachebare Rezept-Response koppeln); Karten read-only ★ avg (count) nur bei `rating_count>0` aus List-Response. | Kein Rating-Widget im Prototyp → gegen C2-Vertrag (`main`) gebaut, nicht gegen Prototyp. | 👤·🔒 gebaut |
| 21 | C3 Facet-Counts: faceted-Semantik — je zählbarer Facette (diet/course/difficulty/category) alle **anderen** aktiven Facetten angewandt, die **eigene** weggelassen; OR innerhalb / AND über Facetten (konsistent zu C1). 0-Optionen inklusive (Backend liefert nur >0, Frontend füllt fehlende Optionen auf 0 und dämpft/deaktiviert sie). `tag`/`allergen_exclude` bewusst **ohne** Counts (Scope schlank). Response-Feld `facets: {diet:{id:count}, course:{value:count}, difficulty:{level:count}, category:{id:count}}`. | Kern der Zero-Result-Diagnose; ~4 gruppierte Count-Queries/Request akzeptabel. | 🔒 gebaut |
| 22 | K1 Kategorie-Übersicht: flache Seite `/categories` (Gradient-Kacheln, Name + `recipe_count`, Klick → `/recipes?category=<id>`) — bewusst **kein** `group`-/Bild-Feld, **keine** Migration. Nav-Heimat: Home-Teaser + BottomNav-„Mehr" (logo-only Navbar nicht umgebaut). Favorites auf kanonische `RecipeCard` (+ optionales `dimmed`-Prop) umgestellt; `primary_image`/Rating serverseitig via `_attach_primary_images`/`_attach_ratings` (eine Quelle, N+1 raus); Legacy-`RecipeCard` in `Recipes.jsx` (verwaist) entfernt. Kategorie-Filtergruppe in Recipes mit `facets.category`-Counts → schließt den offenen C3-Kategorie-Punkt. | Flach + additiv, gegen echten Code gebaut. | 🔒 gebaut |

## Offene technische Punkte
- ~~`Recipes.jsx` sendet `order_by=created_at` statt `sort`~~ → **erledigt in D1** (`ee20271`): serverseitiges `sort` (newest/oldest/rating/time_asc), Client-Sort entfernt.
- `recipe_images` Legacy (tote Tabelle + `RecipeResponse.images`) — Cleanup-Ticket.
- `type`-Param nicht auf `list` migriert (bleibt comma-`str`).
- ~~`Favorites.jsx` nutzt die Legacy-`RecipeCard` mit eigenem N+1~~ → **erledigt in K1** (`a2aea7e`): kanonische `RecipeCard` + serverseitiges `primary_image`/Rating; Legacy-Card entfernt. (`SkeletonCard` wird weiter aus `Recipes.jsx` importiert.)
- **Facet-Counts für `tag`/`allergen_exclude` fehlen** (C3 bewusst schlank). Nachziehbar analog diet/course, falls in der UI benötigt.
- ~~Facet-`category`-Counts ohne Sidebar-Gruppe~~ → **erledigt in K1**: Kategorie-Filtergruppe mit `facets.category`-Counts in Recipes.
- **Tote `recipe_images`-Tabelle** (+ `RecipeResponse.images`) bleibt der einzige offene Redesign-Altpunkt — eigenes Cleanup-Ticket (berührt Detail-Response-Form).

## Arbeitsweise (dauerhaft)
1. **Lead schreibt CC nur Chat-Anweisungen, keine fertigen Codeblöcke — außer ausdrücklich vereinbart. CC schreibt den Code selbst.**
2. Ein Handover = mehrere geordnete Commits, je Self-Check; User reicht einmal an CC, Lead verifiziert den Stapel einmal.
3. Lead entscheidet + loggt; Pause nur bei echten Forks.
4. Docs/Merkliste fließen in denselben Handover.
5. Verifikation gegen `main` bleibt Pflicht.

## Verifikations-Trail (grün)
| Scheibe | Commit(s) |
|---|---|
| Phase A | `424ad64`,`71b5495`,`08489b1` |
| Phase A.1 | `bf43d28`,`8963c3e` |
| B1a RecipeCard | `4ecf428` |
| B1b Home | `e0ae05e`,`1fe97fb` |
| Detail-Politur | `299d192`,`3fbd558` |
| C1 Filter-API | `30ddb73`,`d495db5` |
| C2 Rating (0030) | `7f9dd58`,`0eb599c`,`a71cf9f` |
| D1 Recipes + Optionen | `abec393`,`ee20271`,`2e0a905` |
| D2 Rating-Sterne FE | `5e9e6b0`,`743524c`,`acedaa8` |
| C3 Facet-Counts | `8084f6b`,`301b0b3`,`b7040c1` |
| K1 Kategorien + Favorites-Cleanup | `23cc96a`,`d1bdb39`,`a2aea7e` (+docs) |
