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
| 23 | `recipe_images` vollständig entfernt: Model `RecipeImage` + Relationship `Recipe.images` + `RecipeResponse.images`/`RecipeImageResponse` + tote Löschschleifen (permanent-delete + Recipe-GC). Drop-Migration `0031` (downgrade spiegelt `0001_initial` originalgetreu). Detail-Response hat **kein** `images`-Feld mehr (FE nutzt `media`). `recipe_videos`/`RecipeVideo` bewusst **unberührt** (separate Frage). | Toter Code: kein Writer, FE las `.images` nie (Reads lieferten leere Listen). | 🔒 gebaut |
| 24 | **F1 Kräuterschule-UI:** Sichtbarkeit über zentrale `can_view_*`-Gates (ABO/Rollen später an einer Stelle); `warnung`/`giftige_teile` werden **immer** gerendert; `redaktion_freigegeben` gatet nur die spätere Public-Sichtbarkeit; Beschreibung = Lorem-Fallback, Bild = ein Platzhalter-SVG (Content-Lücken, s. MERKLISTE A). | Sicherheits-Invariante bei Giftpflanzen; Content wird nachgezogen. | 🔒 gebaut |
| 25 | **F2a Garten:** Mein Beet = flache Liste (kein Standort/Anzahl); Task-Engine Stufe b (abhakbar, keine Erinnerungen), abhakbar per Whitelist, Rest = Status; nur `scope=month` (keine Wochen-Linse); „Passend jetzt kochen" weggelassen. Migrationen `0032` (user_plants), `0033` (spotlight_history), `0034` (task_done). | Schlanke, verständliche v1; Erinnerungen/Push später. | 🔒 gebaut |
| 26 | **F2b Shoppingliste v1:** Kern (Liste + aus Rezept übernehmen + manuell + abhaken + Fortschritt); **keine** Warengruppen-Gruppierung (keine Datenquelle → „Nach Rezept" statt Warengruppe), Summierung/Pantry/Teilen/Mic → Merkliste. Migration `0035` (shopping_list_items). | Schlanke Scheibe ohne Warengruppen-Seed. | 🔒 gebaut |
| 27 | **F3 Social — kein OAuth:** manueller Link-Flow (Teilen → „Link kopieren" → oEmbed-Vorschau → speichern) statt „Konto verbinden". Instagram-Beschreibung manuell einfügen (oEmbed liefert keine Caption → sonst keine Zutaten-Extraktion). Social-Chips „verbundene Konten" weggelassen; „Fotos"-Tab → „Beiträge"-Tab. | OAuth = Professional-Konto-Pflicht + App-Review (~2–4 Wochen); geparkt bis App stabil. Vgl. ABWEICHUNGEN F1/F2/F4/F5. | 👤·🔒 gebaut |
| 28 | **F3 Embed-Technik:** Instagram als **direkter Embed-iFrame** (`…/{typ}/{code}/embed/`), TikTok über `embed.js` + `oembed_html`. `oembed_html` **muss** in Feed- und Collection-Response mitkommen (`ExternalPostPublic`), sonst rendert der TikTok-Player nicht. Migrationen `0038` (external_posts), `0041` (external_post_recipe_id). | Instagram `embed.js` liefert live HTTP 503, `window.instgrm` bleibt undefiniert. | 🔒 gebaut |
| 29 | **F3 Feed global + in Home:** globaler Mixed-Stream (Rezept/Post/Kraut-des-Monats, neueste zuerst) statt Follow-Aktivität; **in Home „Entdecken" integriert** (keine `/feed`-Seite, Feed-Icon aus Header entfernt); Cursor-Pagination `created_at desc` + id-Tiebreaker (kein Offset). Post im Feed = **kompakte Kachel + Tap-to-Play** (kein Autoplay-Inline-Embed). `GET /api/feed`, `app/feed/router.py`. | Follow-Fan-out zu teuer für v1; kompakte Kacheln statt 896×640-Embeds. Vgl. ABWEICHUNGEN F9/F10/F11. | 🔒 gebaut |
| 30 | **F3 Draft-Autosave:** neues/Entwurf-Rezept autospeichert als Entwurf (POST einmal → PUT `?skip_version=true`, kein Versions-Spam); „Veröffentlichen" nur im Feinschliff hinter Pflichtfeld-Gate. **Kein** Sofort-Publish, **kein** separater „Sofort-Veröffentlichen"-Weg. **Nur** für Entwürfe — veröffentlichte Rezepte behalten Versions-/Review-Flow unberührt. `RecipeForm.jsx` Z.654 `useRef(null)` (Erst-Load-Fix). Migration `0040` (recipe_status_draft). | Füllt das Entwürfe-Segment; veröffentlichter Pfad darf nicht angefasst werden. Mit Mike bestätigt. | 👤·🔒 gebaut |
| 31 | **F3b-2b Sammlungs-Detail:** `/collections/:id` schlicht im Systemstil (kein Screen designt) — gemischte Items (Rezept-Karte + Post-Kachel→Overlay), anlegen/umbenennen/Sichtbarkeit/löschen, „In Sammlung" aus Rezept + Beitrag. **Kein Reorder** in 2b (API `/reorder` existiert, UI = späteres Frontend-Ticket). Migration `0039` (collection_items). Offener BUG-Kandidat: Picker fällt im Post-Overlay auf den Embed durch (MERKLISTE 23). | Design markiert die Fläche als offen; Reorder-UI aus dem Scope gehalten. | 🔒 gebaut |

## Offene technische Punkte
- ~~`Recipes.jsx` sendet `order_by=created_at` statt `sort`~~ → **erledigt in D1** (`ee20271`): serverseitiges `sort` (newest/oldest/rating/time_asc), Client-Sort entfernt.
- ~~`recipe_images` Legacy (tote Tabelle + `RecipeResponse.images`)~~ → **erledigt in Cleanup** (`37ffe80`): Model/Relationship/Schema/Löschschleifen entfernt, Drop-Migration `0031`.
- `type`-Param nicht auf `list` migriert (bleibt comma-`str`).
- ~~`Favorites.jsx` nutzt die Legacy-`RecipeCard` mit eigenem N+1~~ → **erledigt in K1** (`a2aea7e`): kanonische `RecipeCard` + serverseitiges `primary_image`/Rating; Legacy-Card entfernt. (`SkeletonCard` wird weiter aus `Recipes.jsx` importiert.)
- **Facet-Counts für `tag`/`allergen_exclude` fehlen** (C3 bewusst schlank). Nachziehbar analog diet/course, falls in der UI benötigt.
- ~~Facet-`category`-Counts ohne Sidebar-Gruppe~~ → **erledigt in K1**: Kategorie-Filtergruppe mit `facets.category`-Counts in Recipes.
- ~~Tote `recipe_images`-Tabelle bleibt der einzige offene Redesign-Altpunkt~~ → **erledigt** (`37ffe80`, Migration `0031`). Damit ist der Redesign-/Cleanup-Bogen abgeschlossen; `recipe_videos`/`RecipeVideo` bleiben bewusst unberührt (separate Frage).

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
| K1 Kategorien + Favorites-Cleanup | `23cc96a`,`d1bdb39`,`a2aea7e`,`a4e6041` |
| Cleanup recipe_images (0031) | `37ffe80` (+docs) |
| F1 Kräuterschule / F2a Garten / F2b Shoppingliste | s. `claude/PHASE_F1_ABSCHLUSS.md`, `PHASE_F2A_ABSCHLUSS.md`, `PHASE_F2B_ABSCHLUSS.md` (Migrationen 0026–0035) |
| F3b-1 Externe Beiträge (0038,0041) | `f62a2f6`,`16eb020`,`b1d1986` |
| F3b-2a Profil + Netzwerk (0036,0037) | `e4e3e44`,`92d2ad3`,`c86b564`,`a80d976` |
| F3b-2c Entwurf-Wizard (0040) | `6fa83fa`,`7c06035`,`a17a9a2`,`3f6c72b`,`d4ed976` |
| F3b-3 Globaler Feed | `822e4c3`,`9ea95df`,`98d95b9`,`35817eb` |
| F3b-2b Sammlungs-Detail (0039) | `c45eae1`,`f60bada`,`01fd45c`,`58e0c7c` |
