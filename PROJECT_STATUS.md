# PROJECT_STATUS.md
> Letzte Aktualisierung: 2026-07-12
> Zweck: Session-Starterpaket für neue Claude-Threads. Immer als erstes mitgeben.
> Stand verifiziert gegen `main` (Phase-2-Reconciliation 2026-07-12).

---

## Stack (Kurzreferenz)
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL 16
- **Frontend:** React 19, Vite, Tailwind v4 (@theme in index.css)
- **Infra:** Docker Compose, Caddy, Raspberry Pi 5, Cloudflare Tunnel
- **Dev:** Lokal Windows (`D:\engines\recipes`), Deploy via GitHub → Pi
- **Tests:** `docker compose exec backend python -m pytest tests/ -v`
- **Migrationsstand:** 0001–0027 (höchste: `0027_add_plant_tags_relations.py`)

## Rollen-Modell (korrekt, verifiziert user.py)
Hierarchie: `kuechenchef > chefkoch > koch > kuechenhilfe` — plus `admin` als Sonderrolle.
Default-Rolle neuer User: `kuechenhilfe`.
⚠️ Frühere Docs/Übergaben nannten fälschlich „… > user" — das ist obsolet, es gibt keine Rolle `user`.

## Claude-Zugriff auf den Code

Claude (claude.ai) kann den Code direkt lesen:
- **Browser-Plugin** „Claude in Chrome" (muss verbunden sein) — `get_page_text` auf GitHub liefert echten Text.
- **bash_tool / curl** auf `https://raw.githubusercontent.com/PiEngines/recipes/main/<pfad>` — funktioniert solange Repo öffentlich.
- Repo: https://github.com/PiEngines/recipes, Branch `main`.
- Workflow: Claude navigiert/liest selbst — kein CC als Zwischenstufe für reine Analysen.
- Zu Thread-Beginn: Browser via `tabs_context_mcp` prüfen.

---

## Aktueller Stand

### ✅ Implementiert (verifiziert gegen `main`, Stand 2026-07-05)

| Bereich | Details | Beleg / Datum |
|---|---|---|
| Migrationen 0001–0025 | zuletzt: 0023 extend_recipe_type, 0024 add_course_field, 0025 add_recipe_serve_with | 2026-07-05 |
| **GTM-Basis eingebunden** | index.html zweistufig (head-Snippet + noscript-Iframe), GTM-K2H9JG5J | verifiziert |
| **DataLayer SPA-Fix** | main.jsx `page_view` bei Route-Wechsel via useLocation | verifiziert |
| **Security: Medien-Upload Owner-Check** | media/router.py `_check_owner` auf allen POST/PUT/DELETE-Endpunkten (upload_image, upload_video, update_media, set_primary, crop_thumbnail, delete_media). Chefkoch/Küchenchef/Admin-Vollzugriff **gewollt** | verifiziert |
| **Security: Caddy Security-Header** | Caddyfile: HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, CSP, `-Server`; `respond 403` für /.env, /.git*, /docker-compose*. Tabler-Icons via cdn.jsdelivr.net in style-src + font-src | verifiziert |
| **Design Tokens @theme** | index.css `@theme`-Block (terracotta, app-bg, radius-card etc.) | verifiziert |
| **AdminUsers Frontend-Guards** | AdminUsers.jsx `isKuechenchef`-Gate für Rollen-Dropdown/Delete/Restore | verifiziert |
| **RecipeType Enum erweitert** | recipe.py (grillen, einkochen …), Migration 0023 | verifiziert |
| **Course/Gang-Feld** | Migration 0024 (Backend-Feld vorhanden; Admin-UI dafür noch offen) | verifiziert |
| **serve_with-Feld** | Migration 0025 (Backend-Feld vorhanden) | verifiziert |
| **Kräuterschule Phase 1 — Schema** | Migration 0026: Tabellen plants (40 Felder + redaktion_freigegeben) & phaenophasen; Enums (lebensdauer/anbau_typ/schwierigkeitsgrad/essbarkeit) + CHECK-Constraints inkl. Range-CHECKs (Geschmacksachsen 0–5, standort_eignung 1–3); Unique-slug | 2026-07-12 deployed |
| **Kräuterschule Phase 1 — Seed** | app/plants/seed.py: idempotenter Upsert (plants+phaenophasen), Feld-Schutz (beschreibungstext, redaktion_freigegeben, slug, essbarkeit, giftige_teile, warnung, bild_dateiname werden bei Re-Import NIE überschrieben), leer→NULL; CLI (python -m app.plants.seed) + lifespan-Erstbefüllung (nur wenn Tabelle leer). Quelldaten in backend/app/data/plants/ | 2026-07-12 deployed |
| **Kräuterschule Phase 1 — Endpoints** | GET /api/plants (schlankes DTO, 9 Felder) + GET /api/plants/{slug} (voll, 40 Felder); zentrale Gates app/plants/permissions.py (can_view_plants / can_view_unreleased, aktuell offen für alle Eingeloggten, später ABO/Rollen); 404-statt-403-Leakschutz | 2026-07-12 deployed |
| **Kräuterschule Phase 2 — Schema** | Migration 0027: Tabellen plant_tags + plant_relations; XOR-CHECK (ck_plant_relations_ziel), 2× FK→plants.id (CASCADE), Enum-CHECKs (facet/beziehung/ziel_typ), Indizes | 2026-07-12 deployed |
| **Kräuterschule Phase 2 — Seed** | seed_plant_tags/seed_plant_relations Full-Reload (delete+reload, idempotent, keine schützenswerten Felder); Pflanze-Ziele → ziel_pflanze_id (ziel_name NULL, CHECK-konform); B-Normalisierung Qualifier (nur…/eingeschränkt/nicht direkt aus ziel_name → qualifier, nur ziel_typ=zutat, 20 Zeilen); live: 3138 tags / 875 relations | 2026-07-12 deployed |
| **Kräuterschule Phase 2 — Endpoint** | GET /api/plants/{slug} angereichert: tags (passt_zu/kombiniert_mit als Strings, laenderkueche {name, ist_stil}, alphabetisch) + relationen (mischkultur_gut/schlecht/ersatz; Pflanze-Ziele via aliased+outerjoin auf name+slug aufgelöst, Non-Pflanze ziel_slug=null, qualifier durchgereicht); Sichtbarkeits-Gate (unveröffentlichte Pflanze-Ziele bei !can_view_unreleased gefiltert); List-Endpoint unverändert schlank | 2026-07-12 deployed |
| **Doku-Hygiene** | design/PROJECT_STATUS_UPDATE.md + design/CLAUDE_ERWEITERUNG.md entfernt (Drift-Quellen); CLAUDE.md Migrations-Verweis + obsolete Security-Sektion bereinigt | 2026-07-12 |
| Modul-System | Migration, Backend, API, Frontend | vor 2026-06-28 |
| Ingredient Matching | Pipeline + Review-Flow (0016) | älter |
| Auth / Rollen / Einladungen | Migrationen 0007–0013 | älter |
| Media Upload | Migration 0004, MediaUpload.jsx | älter |
| Soft Delete Rezepte | Migration 0014 | älter |
| Admin Dashboard | AdminDashboard, AdminRecipes, AdminUsers | älter |
| Entwurf-Status entfernt | Migration 0022, Backend + Frontend | 2026-06-25 |
| Chefkoch Modul-Override | modules/router.py `_check_recipe_access` | 2026-06-25 |
| **Bug #7: Bearbeiten-Button Desktop** | RecipeDetail.jsx HeroSection — `md:hidden`-Wrapper entfernt, Preview-Unterdrückung (`!isPreview`) intakt | 2026-07-05 |

#### Session 2026-07-01 (Thread 6) — nachgetragen
| Task | Beleg |
|---|---|
| Bug #19b: Sortier-Button „Standard" statt „Neueste" | Home.jsx navigate-Fix |
| Bug #20: Fav-Herz Dark Mode | FeedCard size 13→20, FavoriteHeart color #555 |
| BackButton: Pill-Design (Terracotta-Tint) + i18n-Basis | RecipeForm-Fix, de.js `backButton: 'Zurück'` |
| BackButton in RecipeDetail linke Spalte integriert | Wrapper-div |
| Home-Grid responsive (2-spaltig Mobile / 3-spaltig Desktop) | Tailwind-Klassen |
| Favorites-Grid (grid-cols-2 lg:grid-cols-3) | — |

#### DataLayer-Events — Verdrahtungsstand (Teil-Implementierung)
Verdrahtet: `page_view` (main.jsx), `fratcher_search` (Fratcher.jsx).
**Offen (10):** `recipe_view`, `favorite_add`, `favorite_remove`, `search_performed`, `cook_mode_start`, `timer_start`, `recipe_create_start`, `recipe_create_complete`, `recipe_edit_start`, `login_success`/`register_success`.
→ Bewusst **nach Redesign**, da die Trägerkomponenten (FavoriteHeart, RecipeDetail, RecipeForm, Recipes) im Redesign ohnehin angefasst werden.

#### Modul-System – Architektur-Entscheidungen (zur Referenz)
- **Modell:** Snapshot-Referenz, kein Fork.
- **Einbinden:** immer ganzes Rezept (V1). **Auslagern:** Button auf Gruppe → Modul-Referenz.
- **Skalierung:** `modul_menge * hauptrezept_portionen / modul_portionen`; `servings_override` + `scale_factor` als Overrides.
- **Zirkelreferenz:** rekursive CTE, HTTP 400 mit deutscher Fehlermeldung.

#### Kräuterschule — Roadmap & Design-Entscheidungen
**Phase 1 (✅ deployed 2026-07-12):** Entität plants (279) + phaenophasen (10), Seed, Read-Endpoints.
**Phase 2 (✅ deployed 2026-07-12):** Facetten & Relationen — pflanzen_tags (passt_zu/kombiniert_mit/laenderkueche), pflanzen_relationen (mischkultur_gut/schlecht, ersatz). Endpoint-Anreicherung (Detail liefert gruppierte tags + relationen) + B-Normalisierung Qualifier. Vokabular-Tabellen bewusst nicht angelegt (Daten vor-kanonisiert; relevant erst Phase 4).
**Phase 3 (nächster Block):** Arbeitskalender — Kalender (1744) + Phaenophasen-Join. ⚠️ Jahresübergang (ref_monat_von=12 > bis=1) → kein reines BETWEEN (README §8.1); Phasen als INT.
**Phase 4:** Recipes-Mapping — Brücken-Tabelle plant_ingredient_map (pflanzen_id ↔ ingredient_id), Exakt-Match zuerst, Fuzzy später (fällt mit matching.py Stage 3 zusammen). Lose Kopplung, kein Merge.
**UI:** bewusst zurückgestellt bis neues Design steht. Frontend-Route geplant /kraeuterschule (Teaser KrauterCard zeigt aktuell noch auf /seasonal).
**Kern-Entscheidungen:** (a) Sichtbarkeit über zentrale can_view_*-Funktionen (späteres ABO-Gate an einer Stelle). (b) Erst hinter Login, später öffentlich schaltbar (slug/SEO bereits vorbereitet). (c) Sicherheits-Invariante: warnung/giftige_teile IMMER rendern; redaktion_freigegeben gatet spätere Public-Sichtbarkeit. (d) essbarkeit/warnung sind auto-vorbefüllt → vor Go-public redaktionell freigeben (README §12). (e) Bilder KI-generiert, nach und nach → UI braucht Platzhalter-Fallback.

---

## 🔲 Offen — priorisiert

### 🔴 Karten-Redesign (Konzept fertig, Thread 7) — nächster großer Block
Einheitliche Grid-Karte `RecipeCard.jsx` (ersetzt FeedCard + RecipeCard + MiniCard).
- Card-Footer: Bild/Gradient + Titel + Autor + Zeit + Favorit-Herz + „Wird geprüft"-Badge. **Raus:** Description, Typ-Pill, Schwierigkeit-Pill.
- HeuteCard bleibt unverändert (Editorial/Hero).
- **Dark-Mode-Fix:** Card-Footer `rgba(255,255,255,0.88)` → `var(--card)`/`var(--surface)`, Textfarbe explizit `var(--text)`.
- Umstellen: Home „Entdecken", MiniCard (Horizontal-Scroll), Recipes.jsx, Favorites.jsx; alte RecipeCard-Definition entfernen.

### 🟡 Redesign restliche Seiten (Design-Prototypen /design/*.dc.html)
| Task | Datei | Notiz |
|---|---|---|
| Startseite Redesign | Home.jsx | Karussell, Fratcher-Teaser, Entdecken-Feed, Infinite Scroll |
| Suchergebnisseite | Recipes.jsx | Desktop Left-Sidebar-Filter, aktive Filter als Chips |
| Detailseite | RecipeDetail.jsx | Hero-Galerie, Schritt↔Zutat-Highlight, Portionen-Skalierung |
| RecipeForm Wizard Phase 1–3 | RecipeForm.jsx | Grundgerüst / Parser / Autosave+Medien |
| Fratcher Optik | Fratcher.jsx | Visuelles Polishing |

> ⚠️ Offener Abgleich: Bug-#7-Fix (Desktop-Position Bearbeiten-Button) wurde funktional getestet, aber NICHT optisch gegen design/Detailseite Desktop.dc.html verifiziert. Beim Detailseiten-Redesign mitprüfen.

### 🟡 GTM / Analytics — nach Redesign
- **DataLayer-Events granular** (10 offen, s.o.).
- **CSP-GTM-Tuning** (Caddyfile): `connect-src` um `https://*.google-analytics.com` erweitern (regionale GA4-Endpunkte werden sonst **stumm** geblockt); `frame-src https://www.googletagmanager.com` ergänzen (GTM-Preview + noscript-Iframe). Scope-Notiz: **Consent Mode v2 Pflicht**; **Ads/AdSense** evtl., **Server-Side GTM** später → erweitert `script-src`/`connect-src` weiter. Verifikation nur via GTM-Preview + Netzwerk-Tab (collect-Requests ≠ blocked).

### 🔴 Bugs offen
| # | Beschreibung | Status |
|---|---|---|
| 21 | Abstand Header→Content fehlt überall — BackButton/Hero kleben an Navbar | geparkt bis Redesign |
| S1 | Seasonal-Tagging bricht beim Startup — seasonal/matcher.py:43 json.loads(text) mit leerem text (JSONDecodeError). Log-Rauschen, Tags werden für betroffene Rezepte nicht gesetzt. **Nicht patchen — Feature soll komplett neu gedacht werden.** | offen, Rethink |
| P1 | Privacy `/users/:id` — PublicProfile läuft ohne ProtectedRoute (main.jsx:100, Z.50 nimmt /users/ von Auth-Redirect aus) → öffentliche Profile. **Prüfen:** liefert der Backend-Endpunkt Daten ohne Auth, und ist das gewollt? | offen, verifizieren |

### 🟠 Getestet / bestätigt
| # | Thema | Ergebnis |
|---|---|---|
| DD | Drag & Drop Touch iPad | ❌ funktioniert nicht → Trigger für `@dnd-kit/core`-Umbau (Wizard Schritt 3) erfüllt |

### 🔲 Offen — Formular-UX / Expertenmodus
| Task | Notiz |
|---|---|
| `form_expert_mode BOOLEAN` auf User | **nicht im Model** (verifiziert 2026-07-05) → Feature komplett offen |
| Expertenmodus-Toggle im Profil | hängt an obiger DB-Spalte |
| Mengenfeld-Validierung (Frontend) | ganze/Dezimal/Brüche/Bereiche erlauben, Rest ablehnen |

### 🟡 Features / UX — Merkliste
- Sortierung „Älteste" (zusätzliche Option)
- „Entdecken" → Link auf Rezepteseite (Home-Sektion klickbar)
- Suchleiste schmal + Fokus-Animation (alle Seiten)
- Kochschritte Erledigt-Button (pro Schritt, nur Kochmodus, springt zum nächsten)
- Stiller Retry `serve_with` PUT (fire-and-forget; Backend-Feld existiert via 0025)
- Headline zwischen Modul-Rezepten (Zutaten-Strecke)
- Autor im Dropdown („Passt dazu"-Suche); Limitierung „Passt dazu" auf max. 3
- **Kategorie-Übersichtsseite (vertagt, zügig nachziehen).** Flach baubar (Name + recipe_count → Gradient-Kacheln, Klick → /recipes?category=<int-id>), zurückgestellt bis: (1) `group`-Feld je Kategorie, (2) Kategorie-Bild oder Gradient-Entscheid, (3) `Recipes.jsx` liest `category` (2 Zeilen), (4) Nav-Heimat (Navbar ohne Link-Leiste, BottomNav ohne Slot). Dann einmal richtig bauen.
- **Detail-Interaktions-Redesign (vertagt, betreut).** Prototyp will Tabs „Zubereitung/Zutaten" + Sidebar rechts (340px sticky) + „Kochmodus starten"-CTA. Bewusst NICHT im Reskin gebaut: gibt die dauerhaft sichtbaren Zutaten auf (UX-Regression) und sitzt auf der Skalierungs-/Timer-/Kochmodus-Logik. Falls gewünscht: eigener betreuter Slice mit Verhaltens-Checkliste, ggf. sub-sliced (erst Tabs, dann Sidebar).
- **`Recipes.jsx` sendet `order_by=created_at` statt des realen `sort`-Params (Phase A #2)** → `?sort=newest`-Links (aus Home „Neue Rezepte") greifen nicht durch. Fix im Phase-D-Alignment von `Recipes.jsx`.

### 🟢 Größere Tasks / geplant
- Edit-Session + Versions-Restore (Auto-Save-Warnung, Banner, Restore)
- Admin-UI Art + Gang (Gang-Feld via 0024 vorhanden — UI fehlt)
- Orphan-Cleanup (Draft-Rezepte + Fotos in DB/Storage)
- Dict/Einheiten-Normalisierung (g/gr/Gramm, Tippfehler)
- Wizard DnD Touch via `@dnd-kit/core` (iPad-Bug bestätigt)
- Kräuterschule UI-Seite (Phase 1 Backend deployed; UI wartet auf neues Design) — siehe Roadmap oben
- AI-Zutaten-Matching Stage 3 (LLM-Fallback) — matching.py:100–102 nur Platzhalter; Stage 1 (exakt) + Stage 2 (rapidfuzz) aktiv, LLM-Matching für paraphrasierte Zutaten offen. Fällt mit Kräuterschule Phase 4 (Recipes-Mapping Fuzzy) zusammen.
- Toter Code entfernen — recipes/router.py: "# TODO: deprecated, replaced by matching.py" (Cleanup).
- Sammel-Cleanup (konsolidiert, nach Michaels Wunsch in einem Durchgang): Root-Artefakte `0006,` / `0007,` / `0008,` (0-Byte, git rm — **erledigt** in Phase-A-Cleanup); toter Code recipes/router.py (# TODO deprecated).

#### Phase-A.1-Nachträge (aus primary_image-Korrektur)
- **[Legacy-Cleanup]** `recipe_images`-Tabelle + `RecipeImage`-Model + `RecipeResponse.images` sind tot (nichts schreibt sie; Frontend nutzt `media`). Eigenes Ticket: entweder entfernen (Migration) oder bewusst als Reserve dokumentieren. **Nicht** im Autopilot — berührt die Detail-Response-Form.
- **Folge fürs Frontend:** Home lässt die per-Rezept `/api/media/entity/recipe/{id}`-Aufrufe + die `*Imgs`-State-Maps fallen und nutzt `recipe.primary_image` → N+1 raus. **Erledigt in B1b** (`e0ae05e`).

#### Phase-B1b-Nachträge (aus Home-Reskin)
- **Home-Hero-Karussell (vertagt, größerer Workstream):** rotierender Hero mit Dots statt „Heute für dich"-Reihe. Braucht Backend `GET /api/recipes/featured` (Kuratierungs-Kriterien = Produktentscheidung) + Karussell-UI/a11y. B1b hat bewusst die bestehende Hero-Reihe behalten (kein `featured` im Backend). Inline-SearchBar ist bereits separat als „Suchleiste schmal" gelistet.

#### Phase-A-Nachträge (verschoben, aus Redesign Phase A)
- **serve-with volle Karte:** `GET /api/recipes/{id}/serve-with` liefert nur `{id, title}`. „Passt dazu" rendert vorerst minimal (Titel + Gradient). Volle `RecipeCard` bräuchte angereicherten serve-with-Endpoint (Bild/Zeit) ODER N Nachfrage-Calls → **verschoben (Phase D)**.
- **Kategorie-`group`-Feld:** Gruppierung/Ordnung der Kategorien noch offen (eigenes Ticket).
- **Rollen-Enum-Bereinigung:** obsolete `user`-Referenzen in Alt-Notizen entfernen (eigenes Ticket).
- **`as_module`-Param** in Deploy-/API-Doku ergänzen (in §4-Doku bisher nicht dokumentiert).

---

## ⏸ Geparkt (bewusst zurückgestellt)
| Task | Notiz |
|---|---|
| Foto-Upload vor erstem Speichern | Technische Lösung ausstehend |
| Modul: Einzelne Gruppe direkt einbinden | Aktuell erst Auslagern nötig |
| Modul: Varianten-Gruppierung im Dropdown | Erst bei häufiger Fremdrezept-Nutzung relevant |

---

## Konventionen (für neue Sessions)
- **data-track-id Schema:** `{seite}-{element}-{aktion}` – alle neuen Komponenten
- **PowerShell:** kein `-Recurse` bei `Select-String`; Befehle einzeilig (`;` als Trenner)
- **Saubere Lösungen vor schnellen Lösungen**; keine Änderungen außerhalb des Scopes
- **Deploy-Befehle:** immer vollständig (lokal UND Pi), Plattform explizit kennzeichnen
- **Vor größeren Teilen:** Umfang einschätzen, ggf. in a/b/c aufbrechen
- **Fragen immer nummerieren**
- **Doku-Drift-Warnung:** Vor jedem „Fix" den Ist-Zustand gegen `main` verifizieren — diese Datei hinkt erfahrungsgemäß hinterher.
- **Ableitungs-/Referenztabellen:** Idempotenz per Full-Reload (delete+reload), kein Upsert/Unique-Key nötig.
- **FK-aufgelöste Relationen im Read-Endpoint:** via aliased+outerjoin (kein N+1).
