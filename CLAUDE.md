# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PiEngines Recipes — a recipe database web app, accessible at `recipes.piengines.com`.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic |
| Frontend | React, Vite, Tailwind |
| Database | PostgreSQL 16 |
| Reverse Proxy | Caddy 2 |
| Container | Docker Compose |
| Runtime | Raspberry Pi 5, Cloudflare Tunnel |
| Dev OS | Windows (D:\engines\recipes) |

## Running the project

```bash
# Copy and fill in credentials
cp .env.example .env

# Build and start all services
docker compose up --build

# Start in background
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Architecture

All services run in an internal Docker network (`internal`). Only Caddy exposes ports 80/443 to the outside.

```
Internet → Caddy (80/443)
├── /api/* → backend:8000 (FastAPI)
└── /* → frontend:3000 (Vite build served via `serve`)
           ↑
db:5432 (PostgreSQL) ← backend
```

- **backend** (`./backend`) — FastAPI app, entry point `app.main:app`, port 8000
- **frontend** (`./frontend`) — Vite/React, built as static files served on port 3000
- **caddy** (`./caddy/Caddyfile`) — TLS termination + reverse proxy; auto-provisions Let's Encrypt certs
- **db** — PostgreSQL with a named volume `postgres_data`; backend waits for healthcheck before starting

## Environment variables

All variables are defined in `.env` (copy from `.env.example`). Key variables:

| Variable | Description |
|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | DB credentials |
| `DATABASE_URL` | Full connection string for the backend |
| `SECRET_KEY` | JWT signing key — generate with `openssl rand -hex 32` |
| `ENVIRONMENT` | `production` or `development` |
| `BACKEND_CORS_ORIGINS` | Allowed CORS origins |
| `VITE_API_BASE_URL` | API base URL injected at frontend build time |

## Backend dependencies (requirements.txt)

Notable packages beyond FastAPI/SQLAlchemy:

- `alembic` — DB migrations
- `python-jose[cryptography]` + `passlib[bcrypt]` — JWT auth and password hashing
- `python-multipart` — file upload support
- `Pillow` — image processing

## Rollen-Modell

Rollen-Enum (`app/models/user.py`, `UserRole`):

| Rolle | Rang |
|---|---|
| `kuechenchef` | höchste reguläre Rolle |
| `chefkoch` | |
| `koch` | |
| `kuechenhilfe` | niedrigste, **Default** für neue User |
| `admin` | Sonderrolle (technischer Vollzugriff) |

Hierarchie: `kuechenchef > chefkoch > koch > kuechenhilfe` (+ `admin`).

**Hinweis:** Es gibt **keine** Rolle `user`. Ältere Notizen/Übergaben mit „… > user" sind obsolet.

Berechtigungs-Konvention: Owner-Checks vergleichen gegen `recipe.created_by` (nicht `owner_id`). Chefkoch/Küchenchef/Admin haben bewusst erweiterten Zugriff auf fremde Rezepte/Medien (Redaktionsrolle).

## Coding conventions

### General
- Saubere Lösungen vor schnellen Lösungen
- Keine Änderungen außerhalb des Aufgabenscopes
- Vor jedem größeren Teil: Umfang einschätzen, ggf. in a/b/c aufbrechen

### Frontend
- Alle neuen Komponenten bekommen `data-track-id` Attribute
- Schema: `{seite}-{element}-{aktion}` (z.B. `recipe-form-submit`, `detail-favorite-toggle`)

### Backend
- Bei Analyse: konkrete `grep`-Befehle mitliefern
- Migrations-Nummerierung: fortlaufend (aktuell bis 0020)

### Deploy
- Befehle immer vollständig ausgeben (lokal UND Pi, am Stück kopierbar)
- Plattform beim Wechsel zwischen Pi/Lokal immer explizit kennzeichnen

### Windows / PowerShell
- Kein `-Recurse` bei `Select-String`
- Stattdessen: `Get-ChildItem ... | Select-String`
- Befehle immer einzeilig ausgeben (`;` als Trenner), sodass sie direkt einfügbar sind – nie mehrzeilig

## Project status & backlog

→ Siehe `PROJECT_STATUS.md` im Root des Repos

## GTM & Analytics

### Einbindung (GTM-K2H9JG5J)

GTM wird in `frontend/index.html` eingebunden — **zweistufig**, wie von Google vorgeschrieben:

**Im `<head>` (so früh wie möglich, vor allen anderen Scripts):**
```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-K2H9JG5J');</script>
<!-- End Google Tag Manager -->
```

**Im `<body>` direkt nach `<body>` (Fallback für No-Script):**
```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-K2H9JG5J"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

### SPA Page View Tracking (React Router)

Da dies eine Single Page App ist, lädt die Seite nur einmal — GTM sieht ohne explizites Pushing nur einen einzigen Page View. Lösung: `useEffect` auf Route-Wechsel in `Layout()` in `main.jsx`.

**In `main.jsx`, in der `Layout`-Komponente ergänzen:**
```jsx
import { useEffect } from 'react'

function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'page_view',
      page_path: pathname,
      page_title: document.title,
    })
  }, [pathname])

  // ... Rest der Komponente unverändert
}
```

### Datalayer-Events — Pflichtschema

Alle relevanten User-Interaktionen werden via `window.dataLayer.push()` getrackt. **Kein direktes `gtag()`** — alles läuft über den DataLayer.

| Event-Name | Trigger | Pflichtfelder |
|---|---|---|
| `page_view` | Jeder Route-Wechsel | `page_path`, `page_title` |
| `recipe_view` | RecipeDetail mount | `recipe_id`, `recipe_title` |
| `recipe_create_start` | RecipeForm neu geöffnet | — |
| `recipe_create_complete` | Speichern erfolgreich (Schritt 5) | `recipe_id` |
| `recipe_edit_start` | RecipeForm edit geöffnet | `recipe_id` |
| `favorite_add` | Herz-Button aktiviert | `recipe_id` |
| `favorite_remove` | Herz-Button deaktiviert | `recipe_id` |
| `search_performed` | Suche abgesendet | `search_term` |
| `fratcher_search` | Fratcher-Suche gestartet | `ingredient_count` |
| `cook_mode_start` | Koch-Modus gestartet | `recipe_id` |
| `timer_start` | Timer ausgelöst | `recipe_id`, `step_number` |
| `login_success` | Login erfolgreich | — |
| `register_success` | Registrierung erfolgreich | — |

**Implementierungsregel:** DataLayer-Pushes gehören direkt in den Handler oder `useEffect` der jeweiligen Komponente — kein separates Analytics-Service-Layer nötig. Beispiel:
```js
// In FavoriteHeart.jsx beim Toggle:
window.dataLayer = window.dataLayer || []
window.dataLayer.push({ event: 'favorite_add', recipe_id: recipeId })
```

---

## Trackbarkeit — IDs & Attribute

### Bestehendes Schema (weiterführen)
Alle interaktiven Elemente bekommen `data-track-id` nach Schema `{seite}-{element}-{aktion}`:
- `home-carousel-swipe`, `home-fratcher-teaser-click`
- `recipe-detail-favorite-toggle`, `recipe-detail-cook-mode-start`
- `recipe-form-step-next`, `recipe-form-submit`
- `search-input-submit`, `fratcher-ingredient-add`

### Zusätzlich: Semantische IDs für kritische Sektionen
Neue Komponenten bekommen außerdem aussagekräftige `id`-Attribute auf Section-Ebene (für Scroll-Tracking und Accessibility):
```jsx
<section id="recipe-ingredients" aria-label="Zutaten">
<section id="recipe-steps" aria-label="Zubereitung">
<section id="home-feed" aria-label="Entdecken">
```

---

## Design Tokens — Tailwind-Erweiterung

**Tailwind v4** (im Projekt installiert) konfiguriert Tokens über CSS `@theme` in `index.css`, nicht über `tailwind.config.js`.

In `frontend/src/index.css` im `@theme`-Block ergänzen (oder anlegen falls nicht vorhanden):

```css
@theme {
  /* Farben */
  --color-app-bg: #FAF7F2;
  --color-body-bg: #E0DDD8;
  --color-card: #ffffff;
  --color-terracotta: #C8602A;
  --color-olive: #6B7C4E;
  --color-text-primary: #2C2C2A;
  --color-text-secondary: #6B6B68;
  --color-text-hint: #9A958C;
  --color-border: rgba(0, 0, 0, 0.07);
  --color-border-input: #D8D4CD;

  /* Border Radius */
  --radius-card: 14px;
  --radius-input: 14px;
  --radius-pill: 9999px;

  /* Typografie */
  --font-display: 'Playfair Display', serif;
  --font-body: 'Inter', sans-serif;
}
```

Verwendung in Komponenten dann via Tailwind-Klassen:
- `bg-app-bg`, `bg-terracotta`, `text-olive`, `rounded-card` etc.

**Regel:** Keine Hex-Werte inline in JSX. Immer Token verwenden.

---

## Security — Pflichtregeln

### HTTP-Header (Caddy)
In `caddy/Caddyfile` folgende Security-Header für alle Responses ergänzen:

```
header {
  X-Content-Type-Options "nosniff"
  X-Frame-Options "DENY"
  X-XSS-Protection "1; mode=block"
  Referrer-Policy "strict-origin-when-cross-origin"
  Permissions-Policy "camera=(), microphone=(), geolocation=()"
  Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net;"
  -Server
}
```

Sensible Pfade explizit blockieren:
```
respond /.env 403
respond /.git* 403
respond /docker-compose* 403
```

### API — Verbindungen & Ressourcen

**Datenbankverbindungen (FastAPI/SQLAlchemy):**
- Connection Pool konfigurieren: `pool_pre_ping=True`, `pool_recycle=300`
- Alle DB-Sessions via `Depends(get_db)` — nie manuell öffnen ohne `finally: db.close()`
- Kein `Session` außerhalb von Request-Kontext

**HTTP-Clients:**
- Kein `requests` (blocking) im async FastAPI-Kontext — ausschließlich `httpx.AsyncClient`
- Immer als Context Manager: `async with httpx.AsyncClient() as client:`
- Timeout immer setzen: `httpx.AsyncClient(timeout=10.0)`

**Datei-Handles:**
- Immer `async with aiofiles.open(...)` statt synchronem `open()`
- Upload-Temp-Dateien nach Verarbeitung löschen (`finally`-Block)

### Offene Sicherheitslücken — sofort beheben (nicht parken)

**🔴 Medien-Upload Owner-Check (media/router.py POST):**
Jeder authentifizierte User kann aktuell Medien zu fremden Rezepten hochladen.
Fix: Vor dem Speichern prüfen ob `current_user.id == recipe.owner_id` oder User ist Küchenchef.
```python
recipe = db.get(Recipe, recipe_id)
if not recipe:
    raise HTTPException(404)
if recipe.owner_id != current_user.id and current_user.role not in [UserRole.kuechenchef, UserRole.chefkoch]:
    raise HTTPException(403, "Keine Berechtigung")
```

**🟡 AdminUsers.jsx Frontend-Guards:**
Rollen-Dropdown, Delete, Restore für Chefkoch sichtbar aber ohne Guards.
Fix: Elemente mit `{currentUser.role === 'kuechenchef' && ...}` wrappen.

### Frontend — Allgemeine Sicherheitsregeln

- Kein `dangerouslySetInnerHTML` außer mit explizit sanitizierten Strings (DOMPurify)
- JWT nur in `httpOnly`-Cookies oder Memory — nie in `localStorage`
- API-Fehler nie rohe Stack Traces an den User ausgeben
- Formulare: immer clientseitige Validierung + aussagekräftige Fehlermeldungen auf Deutsch

---

## Coding Standards — Moderne Patterns

### React (v19)
- Funktionale Komponenten + Hooks — keine Class Components
- `useCallback` und `useMemo` gezielt einsetzen (nicht überall — nur bei echten Performance-Problemen)
- Eigene Hooks für wiederverwendbare Logik: `useRecipe`, `useSearch` etc. in `hooks/`
- Kein direktes DOM-Manipulation außer über Refs
- Loading- und Error-States immer explizit behandeln — kein stilles Scheitern

### API-Calls (Axios)
- Alle Calls über `frontend/src/api/` — nie direkt `axios` in Komponenten importieren
- Axios-Interceptor für Auth-Header und 401-Handling — einmal global, nicht pro Call
- Abbruch bei Komponenten-Unmount: `AbortController` oder Axios `CancelToken`
```jsx
useEffect(() => {
  const controller = new AbortController()
  fetchData({ signal: controller.signal })
  return () => controller.abort()
}, [])
```

### Python/FastAPI
- Alle Endpunkte mit Pydantic-Schemas validieren — kein direktes `request.body()`
- `async def` für alle Route-Handler — kein `def` (blocking)
- Dependency Injection konsequent: Auth, DB, Permissions via `Depends()`
- HTTP-Statuscodes semantisch korrekt: 201 für Create, 204 für Delete, 422 für Validierungsfehler
- Deutsche Fehlermeldungen für User-facing Errors, Englisch für interne Logs

### Allgemein
- Kein auskommentierter Code committen
- Keine `console.log` in Production-Code (ESLint-Regel ergänzen: `no-console: warn`)
- Typen dokumentieren: JSDoc für komplexe Props, Pydantic-Models als Single Source of Truth
- Migrations-Nummerierung fortlaufend: aktuell bis 0022, nächste ist 0023

---

## Design-Referenz

Die Design-Prototypen liegen im Repo unter `/design/`:

```
/design/
  Startseite.dc.html          → pages/Home.jsx (Mobile)
  Startseite Desktop.dc.html  → pages/Home.jsx (Desktop)
  SRP Desktop.dc.html         → pages/Recipes.jsx
  Fratcher Mobile.dc.html     → (neu: pages/Fratcher.jsx)
  Fratcher Desktop.dc.html    → (neu: pages/Fratcher.jsx)
  Rezept anlegen.dc.html      → pages/RecipeForm.jsx (Mobile)
  Rezept anlegen Desktop.dc.html → pages/RecipeForm.jsx (Desktop)
  Detailseite v5.dc.html      → pages/RecipeDetail.jsx (Mobile)
  support.js                  → Runtime für die .dc.html-Dateien
```

**Die `.dc.html`-Dateien direkt im Browser öffnen** (support.js muss im gleichen Ordner liegen). Sie sind klickbare High-Fidelity-Prototypen — keine Produktionscode-Vorlage.

**Fidelity-Anspruch:** Pixel-genau. Farben, Abstände, Typografie und Interaktionen aus dem Prototyp sind bindend. Abweichungen nur mit expliziter Rückfrage.
