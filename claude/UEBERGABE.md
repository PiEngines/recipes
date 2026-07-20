# ÜBERGABE — Recipes Redesign · Lead-Thread (Fortsetzung)

Stand: 20.07.2026 · `main @ 9486252` (live) · Alembic-Head **0034** · Repo: `https://github.com/PiEngines/recipes.git`
Zweck: Schnellstart für einen neuen Lead-Thread. Kanonische Detail-Referenz im Repo: `claude/PHASE_F1_ABSCHLUSS.md`, `claude/PHASE_F2A_ABSCHLUSS.md`, `claude/MERKLISTE.md`.

## 0 · Rollen & Umgebung
- **Lead (du):** planst, verifizierst, schreibst Anweisungen. Nur Lesezugriff via `git clone` (öffentlich). Kein Push/Deploy. Cloud-Umgebung mit Node/Python/Postgres/Docker.
- **CC (Claude Code):** führt aus (git push, Docker, Build). Du siehst CC-Chats nicht — Relay über Mike.
- **CD (Claude Design):** hat den v2-Vorlagensatz geliefert (im Repo). Aktuell nicht gebraucht.
- **Mike (User):** relayt Lead↔CC, deployt selbst per SSH aus `~/recipes`, pusht Doku selbst. **Arbeitet auf Windows** (Downloads unter `D:\Downloads`).

## 1 · Wie mit Mike kommunizieren (verbindlich — Absprachen dieser Session)
- **Knapp & verständlich.** Keine langen Erklär-Blöcke. Stichpunkte wo möglich. „Mach kein Ding draus."
- **Fragen immer nummerieren**, damit Mike einzeln antworten kann.
- **Fakten / Annahmen / Empfehlung klar trennen.** Analytisch, ursachenorientiert, nach Impact priorisiert.
- **CC-Picker (Auswahlfragen von CC):** Mike antwortet mit der **Zahl** — Textantwort unterbricht den Prozess. Der Lead gibt daher nur die **Zahl** zurück; Zusatztext nur, wenn die Option allein nicht reicht (z. B. eine Regel muss korrigiert werden). Die „Empfohlen"-Option war bisher stets die richtige.
- **Bei „prüfen/deployen" — Pflichtform:** (1) Anweisung als **kopierbarer Code**, (2) **nummerierte Testliste** (Seite → Aktion → erwartetes Ergebnis), (3) der **Lead testet selbst per Browser** die erreichbaren Flächen auf `https://recipes.piengines.com` und gibt die Liste zusätzlich aus.
  - Browser-Zugriff **vorher ankündigen**. Stehendes Go für recipes.piengines.com.
  - **Nach jedem Deploy zuerst „Bitte einloggen" sagen** — die Session läuft beim Backend-Neustart ab. Der Lead gibt **nie** Passwörter ein.
- **Doku/Dateien reisen nicht mit Code-Commits mit.** Mike pusht sie selbst (Windows): `mkdir claude -Force` → `Copy-Item "D:\Downloads\<datei>" claude\` → `git add claude; git commit; git push`. Alternativ CC.
- **Prototyp gewinnt** bei Konflikt SPEC-Text vs. Screen (außer es bricht Dark-Mode/globale Architektur → dokumentierte Abweichung).
- **Bei echtem Fork / fehlenden Werten: anhalten & fragen, nicht raten.**

## 2 · Arbeitskonventionen für CC-Handovers
- **Push- & Melderegel:** „Fertig" = auf `origin/main` gepusht. Jeder Commit sofort pushen; CC meldet „Commit N auf origin/main: `<hash>`". „liegt auf main" ohne Hash zählt nicht.
- **Handover-Stil:** keine fertigen Codeblöcke an CC — beschreibe WAS/WO/Verhalten; CC schreibt Code. Ein Handover = geordnete Commits, je Self-Check, jeden Commit einzeln pushen.
- **Tokens statt Literale**, kanonische Bausteine wiederverwenden (`RecipeCard`, `categoryColors.js`, `components/ui/`, `AuthShell`, Platzhalter-SVG).
- **Lead-Verifikation je Commit:** frischer Clone von `origin/main`, gezielte Greps + `npm ci && npx vite build`; Migrationen up/down gegen **echtes Postgres** (Setup s. §8); Verträge prüfen (z. B. `model_json_schema()` byte-identisch); `data-track-id` erhalten; danach **live per Browser** in Mikes Session, Mike bestätigt auth-Sichten.

## 3 · Fertig & live
- **Phase 0** — Design-System (Tokens, Fonts, zwei Farbwelten, Dark-Mode, `components/ui/`, RecipeCard, BottomNav, Header).
- **Phase G** — alle Seiten restyled inkl. Rezept-Detail (Tabu-Zone Kochmodus/Timer/Skalierung unangetastet).
- **F1 — Kräuterschule** (`/kraeuterschule`) + Pflanzen-Detail (`/pflanzen/:slug`): Steckbrief/Anbau/Rezepte, Giftwarnung prominent, Spotlight „Kraut des Monats", Regal-Zuordnung. Details: `claude/PHASE_F1_ABSCHLUSS.md`.
- **F2a — Garten** (`/garten`): Mein Beet (flache Liste, Phase-Badge), Kalender (Saison + Arbeit mit abhakbaren Aufgaben). Details: `claude/PHASE_F2A_ABSCHLUSS.md`.

## 4 · Offen — nächster Task: F2b Shoppingliste
Screen `shoppingliste.html`. **Backend komplett neu** (kein Shopping-/Pantry-Modell; keine Warengruppen-Datenquelle). Inventur ist gemacht; **Scope-Entscheidungen offen:**
1. **Warengruppen-Gruppierung** — keine Datenquelle. (a) statische Zutat→Warengruppe-Tabelle seeden, (b) Stichwort-Heuristik, (c) v1 nur „Nach Rezept". *(Lead-Empfehlung: c, Warengruppe später.)*
2. **Summierung** gleicher Zutaten über Rezepte (nur gleiche Einheit) — v1 oder später?
3. **Pantry/„Basics"** (Vorratsliste, „vorhanden") — v1 oder später?
4. **Teilen** (Text-Share) + **Mic-Eingabe** — vermutlich später.
*Lead-Empfehlung schlanke v1:* Kern (Liste + aus Rezept übernehmen + manuell + abhaken + Fortschritt + „Nach Rezept"-Gruppierung), Rest → Merkliste. **Erst Scope mit Mike klären, dann Handover.**

## 5 · Danach
- **F3 Social** (größter/riskantester Brocken): Feed, Follow/Stories, Sammlungen, Insta/TikTok-Integration → schaltet das volle Profil frei (Stats, Follow, Netzwerk, Sammlungen, Fotos, Bio, Entwürfe).
- **Content-Strang** (hängt an Mike/Redaktion): Beschreibungstexte (279), echte Rezepte, Pflanzenbilder, Freigabe.
- **Merkliste** (`claude/MERKLISTE.md`): Probleme-Tab, Sorten, „Alle →", Wochen-Linse, Erinnerungen/Push, „Passend jetzt kochen", Saison-Badge, Zeit-Feld, Fratcher-Perf, Timer-Warnfarbe, Danger-Sweep, Saison-Bug.

## 6 · Bewusste Abweichungen (nicht „fixen")
- Kräuterschule: kein Probleme-Tab, keine Sorten, kein Teilen-Button; „Alle →" = Anzahl-Badge; Beschreibung = Lorem-Fallback; Bild = ein Platzhalter-SVG für alle; Heilkräuter querschnittlich (Pflanze in 2 Regalen).
- Garten: kein Standort/keine Anzahl (Mein Beet = flache Liste); Task-Engine Stufe b (abhakbar, keine Erinnerungen); abhakbar = Whitelist (Aussaat/Direktsaat/Vorkultur/Pflanzung/Rückschnitt/Winterschutz/Teilung), Rest = Status; nur `scope=month` (keine Wochen-Linse); „Passend jetzt kochen" weggelassen.
- Bottom-Nav „Garten" → `/garten` (Mein Beet).

## 7 · Verträge / Gotchas
- **Sichtbarkeit:** `can_view_unreleased()` liefert für alle `True` → alle 279 Pflanzen sichtbar, obwohl 0 freigegeben. Bei Verschärfung Freigabe nötig (`PATCH /api/plants/{slug}/release` existiert).
- **`PlantDetail`-Vertrag stabil**; `PlantListItem` hat additiv `weitere_kategorien`.
- **`BeetItem`:** `user_plant_id, plant_slug, deutscher_name, planted_on, phase_badge`.
- **Kalenderdaten nur monatsscharf** (Phänophase → `ref_monat_von/bis`; kein Tag/Woche). Phase→Monat via `GET /api/plants/phases`.
- **Aufgaben abgeleitet** (nicht gespeichert); Erledigt-Status in `user_plant_task_done` (`task_key` trägt Phasenfenster; period-getrennt). Abhaken validiert `task_key` gegen abgeleitete Aufgaben.
- **`RecipeMatchItem`** hat kein Zeit-Feld (Pflanzen-Rezeptzeile = Art · Autor).
- Rezept-Detail = **Tabu-Zone** (Kochmodus/Timer/Skalierung/Cross-Highlighting).

## 8 · Deploy, Rollback & Lead-Verifikations-Toolchain
- **Deploy Frontend-only** (kein Backend/Migration): `cd ~/recipes && git rev-parse HEAD` (Anker) `→ git pull --ff-only origin main → docker compose up -d --build frontend`.
- **Deploy mit Backend/Migration** (z. B. F1/F2a — **Migration läuft NICHT automatisch**): `git pull --ff-only origin main → docker compose build backend frontend → docker compose run --rm backend alembic upgrade head → docker compose up -d backend frontend`.
- **Rollback:** additive Tabellen → nur Code zurück (`git checkout <anker>` + rebuild), **kein DB-Downgrade** nötig.
- **Ephemeres Postgres im Lead-Container** (für Migration up/down): als Nicht-Root-User `initdb`/`pg_ctl` auf Port 5433; `pip install -r backend/requirements.txt --break-system-packages`; nur `DATABASE_URL` + `SECRET_KEY` nötig (alle anderen Settings haben Defaults); dann `alembic upgrade head` / `downgrade`. Wegwerf-DB, Prod unberührt.
- Live-Anker: Code `9486252` · DB `0034`.

## 9 · Repo-Referenzen
- **Design (bindend):** `design_handoff_piengines_v2/` — `SPEC.md`, `screens/*.html`. ⚠️ `design/` + `design_PROTOTYPES/` = ALT, nicht nutzen.
- **Lead-Docs:** `claude/PHASE_F1_ABSCHLUSS.md`, `claude/PHASE_F2A_ABSCHLUSS.md`, `claude/MERKLISTE.md`, `claude/UEBERGABE.md` (dies).
- **Backend:** `app/plants/*`, `app/garden/*`, `app/models/*`, `alembic/versions/` (Head 0034).
- **Frontend:** `src/pages/{Kraeuterschule,PflanzenDetail,Garten,GartenKalender,RecipeDetail,…}`, `src/theme/{categoryColors,plantShelves,plantCalendar,gardenTasks}.js`, `src/api/plants.js`, `src/components/{RecipeCard,BottomNav,ui/,auth/}`.

**Erster Schritt im neuen Thread:** F2b-Scope (§4, Punkte 1–4) mit Mike klären → CC-Handover schreiben. Falls F2a-Doku-Push noch offen ist: Hash von Mike prüfen.
