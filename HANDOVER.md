# CC-Handover — D2: Rating-Sterne (Frontend) + Docs

Basis: `main` @ `2e0a905` (Alembic-Head 0030). Frontend-only, keine Migration, kein Backend-Change.
Backend-Vertrag (C2) verifiziert gegen `main` — NICHT gegen Prototyp bauen (Prototypen haben kein Rating-Widget).
3 geordnete Commits, je Self-Check. Einmal ausführen, dann zurück zum Lead zur Verifikation.

---

## Verifizierter Vertrag (Ist-Zustand gegen `main`)

**Endpoints** (Router-Prefix `/api/recipes`, `backend/app/ratings/router.py`):
- `GET /api/recipes/{id}/rating` → `{avg, count, my_stars}` — `get_optional_user`, funktioniert auch ausgeloggt (`my_stars` dann `null`). `avg` ist serverseitig auf 1 Dezimale gerundet.
- `PUT /api/recipes/{id}/rating {stars:1-5}` → gibt dasselbe Aggregat inkl. `my_stars` zurück (Upsert). 403 bei eigenem Rezept.
- `DELETE /api/recipes/{id}/rating` → Aggregat nach Entfernen. Auth nötig.

**Detail-Response** (`GET /api/recipes/{id}`) hat `rating_avg`, `rating_count`, `created_by`, `author` — kein `my_stars` (bewusst; User-Daten nicht in cachebare Rezept-Response koppeln → separater Rating-Call).
**List-Response** (`RecipeListItem`) hat `rating_avg` + `rating_count` bereits → Karten-Sterne ohne Extra-Call.
**Frontend heute:** weder `RecipeDetail.jsx` noch `RecipeCard.jsx` rendern Rating. `RecipeDetail.jsx` nutzt `client` (`../api/client`), `useAuth()`→`user`, `useParams()`→`id`. `--accent: #C8602A` existiert (`styles/tokens.css`).

---

## Commit 1 — feat(rating): RatingStars-Komponente + Rating-Widget auf RecipeDetail

### 1a) Neue Datei `frontend/src/components/RatingStars.jsx` (kanonisch, rein präsentational)
- Rendert 5 SVG-Sterne. Farbe gefüllt `var(--accent)`, leer `var(--border)`. Größe via `size`-Prop (default 20).
- `interactive={false}` (Default, Anzeige): fraktionale Füllung für `value` (z. B. 4.3). Technik: zwei identische Stern-Reihen übereinander, obere (gefüllte) Reihe per Wrapper `width:${(value/5)*100}%; overflow:hidden` beschnitten → echte Halbsterne. Kein Klick.
- `interactive={true}` (Eingabe): ganze Sterne. Hover-Preview (lokaler `hoverIdx`-State), Klick → `onRate(n)` (n=1..5). Sterne bis `hoverIdx ?? value` gefüllt. `cursor:pointer`, `role="button"`/`aria-label` je Stern.
- Props: `value` (number, 0=keiner), `size`, `interactive`, `onRate`, ggf. `title`. Keine Business-Logik, kein Fetch — nur Darstellung.

### 1b) `frontend/src/pages/RecipeDetail.jsx` — Widget einhängen
- State: `const [rating, setRating] = useState(null) // {avg, count, my_stars}`
- Fetch im bestehenden `useEffect` nach `setRecipe(r)`, analog zu serve-with/media: `client.get(.../rating).then(rr => setRating(rr.data)).catch(() => {})`
- Handler: `submitRating(stars)` (PUT), `clearRating()` (DELETE), `canRate = !!user && !!recipe && recipe.created_by !== user.id`. PUT/DELETE liefern das Aggregat → kein zweiter GET nötig.
- Modul-Komponente `RatingBlock` (Datei-Ebene, Stil wie MetaBar) — importiert `RatingStars`.
- Einfügepunkt: in der Haupt-Render-Rückgabe zwischen `{/* Author block */}`-Wrapper und `{/* Steps heading */}`.
- Import: `import RatingStars from '../components/RatingStars'`.
- Verhalten: ausgeloggt → nur Ø-Anzeige (kein Setter, `canRate=false`). Eigenes Rezept → nur Ø-Anzeige (kein 403-Risiko).

**Self-Check Commit 1:** Build/Lint grün, keine ungenutzten Imports. Manuell: eingeloggt fremdes Rezept → setzen/ändern/entfernen aktualisiert Ø sofort; eigenes Rezept → kein Setter; ausgeloggt → nur Ø bzw. „Noch keine Bewertung".

---

## Commit 2 — feat(rating): read-only Ø-Rating auf RecipeCard

`frontend/src/components/RecipeCard.jsx` — Meta-Zeile erweitern. Nur wenn `rating_count > 0` (keine leeren Sterne). Nutzt `recipe.rating_avg/rating_count` aus der List-Response (kein Extra-Call). Kompaktes Text-Badge `★ avg (count)` — keine 5-Stern-Reihe auf Karten (bewusst, gegen Rauschen).

**Self-Check Commit 2:** Build grün. Karte mit `rating_count>0` zeigt `★ 4.3 (12)`; unbewertete Karte unverändert. Home + Recipes nutzen dieselbe kanonische `RecipeCard` → beide abgedeckt. Achtung: die lokale `RecipeCard` in `Recipes.jsx` (von `Favorites.jsx` genutzt) NICHT anfassen.

---

## Commit 3 — docs: D2-Entscheidungen, PROJECT_STATUS-Refresh, HANDOVER.md
- `DECISIONS.md` — neuen nummerierten Eintrag (nächste freie Nummer): Widget-Platzierung, Optik, `my_stars`-Trennung, Karten-Badge.
- `PROJECT_STATUS.md` refreshen: Kopf-Datum, Alembic-Head 0030, Redesign-Blöcke (A/A.1, B1a, B1b, Detail-Politur, C1, C2, D1, D2) als erledigt; Tabelle Recipes/Detail; `order_by`-Offenpunkt streichen; Karten-Redesign erledigt.
- `HANDOVER.md` ins Repo-Root (diese Datei, versioniert).

**Self-Check Commit 3:** Keine toten Verweise; Alembic-Head konsistent 0030; DECISIONS-Nummerierung lückenlos.

---

## Deploy (nach dem Stapel, Pi-seitig)
`git pull` → `docker compose up -d --build frontend`. Kein `alembic upgrade` (keine Migration). Backend unverändert → `pytest tests/ -v` optional als Regressionscheck.

## Rückmeldung an Lead
Commit-Hashes der 3 Commits melden → Lead zieht `main` (frischer Clone) und verifiziert Anker + Vertrag.
