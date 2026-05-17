# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**PiEngines Recipes** — a recipe database web app, accessible at `recipes.piengines.com`.

## Stack

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Backend      | Python 3.12, FastAPI, SQLAlchemy, Alembic |
| Frontend     | React, Vite                       |
| Database     | PostgreSQL 16                     |
| Reverse Proxy| Caddy 2                           |
| Container    | Docker Compose                    |

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
              ├── /api/* → backend:8000  (FastAPI)
              └── /*     → frontend:3000 (Vite build served via `serve`)
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
