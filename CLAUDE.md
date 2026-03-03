# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A field sales tool for a pan rallado (breadcrumb) distributor in Uruguay. A salesperson selects a neighborhood, the app queries Google Maps for food-related businesses, Claude scores the top 10 prospects, optimizes the visit route, and the salesperson tracks each visit from a mobile-friendly dashboard.

## Running locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run the API (from repo root)
uvicorn backend.api:app --reload --port 8000
```

The frontend is served as static files by FastAPI at `/`. Open `http://localhost:8000`.

### Required environment variables (`.env`)

```
ANTHROPIC_API_KEY=
GOOGLE_MAPS_API_KEY=
DATABASE_URL=                  # PostgreSQL connection string
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TWILIO_WHATSAPP_TO=
```

## Running tests

```bash
python tests/test_places.py
python tests/test_groq.py
```

No test framework — tests are standalone scripts that exercise the Google Maps and Groq integrations directly.

## Architecture

### Backend (`backend/`)

| File | Responsibility |
|------|---------------|
| `api.py` | FastAPI app, all HTTP endpoints, Claude tool-use chat loop |
| `main.py` | Google Maps search logic, `BARRIOS` config, `generar_roadmap()` orchestrator |
| `scorer.py` | Sends business list to Claude, gets back top-10 ranked JSON |
| `router.py` | Calls Google Maps Directions API with `optimize_waypoints=True` |
| `database.py` | PostgreSQL via psycopg2, all CRUD for the `negocios` table |
| `notifier.py` | Sends the daily roadmap over WhatsApp via Twilio |

**Request flow for `/generar-roadmap`:**
1. `main.buscar_negocios()` queries Google Maps Places for each category in the selected neighborhood
2. `scorer.score_negocios()` calls Claude to rank and explain the top 10
3. `router.optimizar_ruta()` calls Google Maps Directions to reorder visits by driving efficiency
4. Each selected business is written to the DB via `database.registrar_negocio()`

**Two business modes** controlled by the `modo` field:
- `"chico"` — retail (pizzerías, rotiserías, carnicerías, supermercados…)
- `"grande"` — industrial (frigoríficos, plantas procesadoras, distribuidoras…)

**Chat endpoint (`/chat`)** uses Claude with tool use. Tools available:
- `marcar_visitado` — sets visit status (visitado / interesado / cliente / no_interesado)
- `agregar_nota` — saves notes without changing status
- `buscar_negocios` — triggers a new roadmap search
- `enviar_whatsapp` — generates and opens WhatsApp with a personalized message

The full tool set is only offered when `negocio` is present in the request (i.e., the user has an active business selected). Otherwise only `buscar_negocios` is offered.

### Frontend (`frontend/static/`)

Vanilla JS split into modules loaded via `<script>` tags. Global state lives in `state.js`.

| File | Responsibility |
|------|---------------|
| `state.js` | Shared globals: `negociosData`, `negocioActivo`, `historialChat`, etc. |
| `roadmap.js` | Calls `/generar-roadmap`, renders the business list |
| `mapa.js` | Google Maps JS SDK, markers and info windows |
| `chat.js` | Chat UI, calls `/chat`, handles tool responses from backend |
| `visitado.js` | Visit form, calls `/marcar-visitado` |
| `dashboard.js` | History view with filters, stats, Excel/PDF export |
| `navigation.js` | Screen switching between: generar → lista → mapa → chat → dashboard |
| `utils.js` | Shared helpers (formatting, WhatsApp URL builder) |

Screens are `<div>` elements toggled by `navigation.js`. The active screen name is tracked in the `screens` object in `state.js`.

### Database

Production: PostgreSQL (connection via `DATABASE_URL`).
The `negocios` table has a single key: `(nombre, direccion)` — used to avoid re-showing already-visited businesses.

Key fields beyond the composite key: `visitado` (bool), `resultado` (enum-like text), `barrio`, `tipo`, `telefono`, `horario`, `email`, `tipo_negocio`, `nivel_operativo`, `tiene_rotiseria`, `tiene_produccion_propia`, `notas`, `fecha_primera_visita`, `fecha_ultima_visita`.

`registrar_negocio()` inserts without marking as visited. `marcar_visitado()` does a dynamic UPDATE — only overwrites fields that are passed with a value, so partial updates from the chat don't clobber existing data.

### Deployment

Railway. Build: Nixpacks. Start command: `uvicorn backend.api:app --host 0.0.0.0 --port $PORT`.
