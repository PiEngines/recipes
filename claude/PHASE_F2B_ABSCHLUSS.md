# PHASE F2b — ABSCHLUSS · Shoppingliste + Bring!-Integration

Stand: **live deployed & verifiziert** · 20.07.2026 · `origin/main @ 923175b` · Alembic-Head **0035** · Ablage: `claude/PHASE_F2B_ABSCHLUSS.md`

## 1 · Commits
| # | Hash | Inhalt |
|---|---|---|
| Handover 1 | `732a66d` | Modell `shopping_list_items` + Migration **0035** (additive Tabelle) |
| Handover 2 | `3d8c626` | API Einkaufsliste (`/api/shopping-list`: get/items/from-recipe/patch/delete/clear-done) |
| Handover 3 | `08a9b75` | Einkaufsliste-Seite + Nav-Eintrag + `api/shopping.js` |
| Handover 4 | `ee2f25a` | Übernehmen-Screen (`/recipes/:id/zur-liste`) + „Zur Shoppingliste" auf RecipeDetail |
| Handover 5 | `e9bd87e` | Bring!-Klon-Endpoint (signierter Token) + JSON-LD |
| Handover 6 | `b06cd61` | Bring!-Button auf RecipeDetail |
| Nachtrag1 1 | `4304690` | Mint-Permission erweitert: Autor/Redaktion **ODER** `free_for_all` |
| Nachtrag1 2 | `996fcb6` | Shopping-/Bring-Tests im Repo (66 neu; Gesamtsuite 169) |
| Nachtrag2 1 | `3fb69d4` | Übernehmen-CTA-Overlap-Fix (Desktop) |
| Nachtrag2 2 | `923175b` | Bring!-Mobile-Fix (Pre-Mint + echter `<a>`-Tap) + TTL 7200 |

Deploy = Backend + Frontend + **Migration 0035** (`docker compose run --rm backend alembic upgrade head` vor `up -d`). Nachträge = Frontend + Backend, keine Migration.

## 2 · Was live ist
- **Einkaufsliste** (`/einkaufsliste`, Nav „Mehr"): eine implizite Liste je User. Zutaten aus Rezept übernehmen (Mengen auf gewählte Portionen eingefroren), manuell hinzufügen, abhaken, Fortschritt, Position löschen, „⋯" erledigte entfernen. Ansichts-Toggle **„Summiert ↔ Nach Rezept"** (Default „Nach Rezept").
- **Bring!-Integration** (per Rezept, Deeplink): „An Bring! senden" auf RecipeDetail → signierter, ablaufender Token → öffentlicher, **zustandsloser** Klon-Endpoint rendert serverseitig HTML + schema.org/Recipe-JSON-LD → Bring! crawlt die URL. Öffnet auf Android die Bring!-App (verifiziert Pixel 6).

## 3 · Neu (Verträge / Gotchas)
- **`shopping_list_items`** (Migration 0035, additiv): `user_id` (FK CASCADE, index), `recipe_id` (FK **SET NULL**, nullable = manuell), `recipe_title` (Snapshot), `name`/`amount`/`unit` (Snapshots, `amount` bereits skaliert), `checked`, `sort_order`, `created_at`. Item ist **self-contained** (Snapshots) — Portionen/Skalierung beim Übernehmen eingefroren; Rezept-Umbenennung/Löschung lässt die Liste unberührt.
- **Summierung** (`app/shopping/aggregate.py`, reine Funktion): fasst nur bei **identischem normalisiertem Namen UND identischer Einheit** zusammen, und nur wenn **alle** Beträge als `Fraction` parsen (via `amount_parser`). Sonst getrennt. Aggregierte Zeile trägt `merged_from_count`, `recipe_titles`, **`source_ids`** (nötig zum Abhaken der Summenzeile — schaltet alle Quellen). Erledigt nur, wenn **alle** Quellen erledigt.
- **Fortschritt** zählt immer **Einzel-Positionen** — auch in der Summiert-Ansicht (stabil beim Umschalten).
- **`GET /api/shopping-list?group=recipe|sum`**: `recipe` → Gruppen in Anlege-Reihenfolge, manuelle Positionen zuletzt („Ohne Rezept · manuell"); `sum` → flache, summierte Liste.
- **Bring!-Token** (`app/bring/tokens.py`): `python-jose` JWT mit `secret_key`, Claims `{rid, exp, type:"bring_share"}`. Eigener `type` — ein Access-Token geht **nicht** als Share-Token durch (getestet). Ungültig/abgelaufen/falscher Typ → Klon **410**.
- **Klon-Endpoint** `GET /api/share/recipe/{token}` (**kein Auth**, Token autorisiert): unter `/api/` (Caddy routet nur `/api/*` ans Backend). Gate: `status=published` + `deleted_at IS NULL`. Liefert `noindex` (Meta **+** `X-Robots-Tag`). Zeigt Rezept an **Basis-Portionen** (nicht an Einkaufslisten-Skalierung). JSON-LD: `name`, `author`, `recipeIngredient[]`, optional `image` (absolut über `storage.get_url`, nur `processing_status=="ready"`), `recipeYield`. **Kein** `recipeInstructions` (Datensparsamkeit). Script-Escape: `<` → `<` (kein `</script>`-Ausbruch, getestet).
- **Mint-Permission** `POST /api/recipes/{id}/bring-link`: **Autor/Redaktion ODER `free_for_all`** (aktiv, `declined_at IS NULL`, nicht abgelaufen — Prädikat gespiegelt aus `_apply_visibility_filter`). Bewusst **nicht** „darf sehen" pauschal → kein Re-Share individuell freigegebener Rezepte.
- **Bring!-Frontend**: Link wird **vorab gemintet** (bei Rezept-Load; Re-Mint bei `visibilitychange`/`focus`); Button ist ein **echter `<a href>`** (kein `await`/`window.open` im Klickpfad) — nur so öffnet Android die App statt Play-Store-Fallback. 403 → Button inert + deutscher Hinweis.
- **TTL** `BRING_LINK_TTL_SECONDS` default **7200** (Code-Default; nicht in `.env.example`).

## 4 · Regeln (Lead-entschieden)
- **Toggle = Summiert ↔ Nach Rezept** (Default „Nach Rezept").
- **Bring! = per-Rezept-Deeplink** (kein List-Level-Sync; kein Partneraccount/OAuth; keine CSP-Änderung).
- Öffentlichkeit nur über bestehendes **`free_for_all`** — kein globales Öffentlich-Schalten; Klon per Token auch für nicht-öffentliche eigene Rezepte des Autors.
- Summierung **konservativ** (gleiche Einheit, alle Beträge parsebar) — „lieber zwei ehrliche Zeilen als eine falsche Menge".

## 5 · Bewusst weggelassen → Merkliste (Abschnitt D)
Warengruppen-Gruppierung, Pantry/„Basics", Beet-Match-Hinweis, Mic-Eingabe, Teilen-Sheet, **Bring! List-Level-Sync**, Summierung mit Fuzzy-Namen/Einheiten-Umrechnung, Default-Ansicht als User-Setting, `free_for_all`-Helper entdoppeln, kurzes Stale-Render der Liste direkt nach „Übernehmen".

## 6 · Verifikation (Lead)
- **Statisch:** Kette linear; `data-track-id` vollständig; **0 Hex-Literale** in neuen Frontend-Files (Tokens inkl. `--bring`); app importiert, alle 5 Routen registriert.
- **Migration 0035** gegen **echtes Postgres 16:** up/down/re-up reversibel; Schema exakt (FK CASCADE/SET NULL, Index, Nullability, Defaults); `recipes.seasonal_tags` bleibt **ARRAY** auf PG; ein Head, keine Verzweigung.
- **Summierung** direkt getestet (gleiche Einheit summiert, Brüche, Einheit-Mismatch/unparsebar getrennt, erledigt nur wenn alle Quellen).
- **E2E gegen Postgres** (TestClient): from-recipe skaliert (2→4 verdoppelt), Rezept/Sum-Ansicht, Fortschritt über Einzel-Items, Owner-404, clear-done. Permission-Matrix (Autor/Redaktion/Fremd-free_for_all/Fremd-privat/Grantee/abgelaufen) alle korrekt. Klon: 200 + noindex, Basismenge, Script-Escape, 410 bei abgelaufen/Müll/Access-Token.
- **Committete Suite:** 169 passed (inkl. TTL-Test auf 7200).
- **Live (Browser, `recipes.piengines.com`):** Klon öffentlich erreichbar (410 auf abgelaufenen Token übers offene Netz = Endpoint live); Bring!-Chain öffnet Bring!, Parser zielt auf unsere Klon-URL. Nach Nachtrag 2: Übernehmen-CTA klickbar, Zutat landet, Abhaken + Fortschritt, **Persistenz über echten Reload** bestätigt. **Bring!-App öffnet auf Pixel 6** (Mike bestätigt).

## 7 · Datenlage / Notes
- In prod praktisch keine `free_for_all`-Rezepte → Bring!-Button greift breit erst mit Content (Merkliste-Kopplung).
- Pre-existing (nicht F2b): `recipes.difficulty` ist in der DB NOT NULL, im ORM nullable — Modell/DB-Drift, unabhängig notieren.
