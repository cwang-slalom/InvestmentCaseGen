# Investment Case Generator

Phase 1 proof of concept for a concept-first Investment Case Generator.

The app helps users identify investable concepts and turn them into
source-grounded donor and investor materials. It does not assume that GPD, the
Gates Foundation, or the application user is the funding recipient.

## Phase 1 Runtime

Phase 1 is UI-complete and integration-light:

```text
Browser
  -> same-origin FastAPI application
  -> /api/*
  -> server-side GenerationBackend
  -> mock backend or future Databricks backend
```

FastAPI serves the compiled React/Vite application and all `/api/*` routes from
one public process. No production Node.js server, Prisma database, SQLite
store, external API host, or live Databricks model endpoint is required.

## Repository Structure

- `frontend/` - React, TypeScript, Vite Phase 1 app.
- `backend/` - FastAPI API, in-memory repositories, mock generation backend,
  and Databricks backend seam.
- `prompts/` - core prompt rules and task prompt examples.
- `fixtures/` - reserved for future fixture files.
- `docs/` - deployment notes, client checklist, limitations, plan, decisions.
- `legacy/next-app/`, `src/`, `prisma/`, and related Next-era files - bypassed
  legacy MVP work kept for reference unless explicitly removed later. The
  legacy Next app is archived outside `src/app` so build tools do not infer an
  active Next.js workspace.

## Development

Install dependencies:

```bash
npm install
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Run the backend:

```bash
UVICORN_HOST=127.0.0.1 UVICORN_PORT=8000 backend/.venv/bin/python -m backend.main
```

Run the Vite dev server in another shell:

```bash
npm run dev
```

Open `http://localhost:5173`.

Build the production frontend:

```bash
npm run build
```

Run the production-style single process locally:

```bash
UVICORN_HOST=127.0.0.1 UVICORN_PORT=8000 backend/.venv/bin/python -m backend.main
```

Open `http://127.0.0.1:8000`.

## Checks

```bash
npm run check
cd backend && .venv/bin/python -m pytest
```

`npm run check` runs TypeScript, ESLint, and Vitest for the active
`frontend/` app.

## Databricks Apps

Deploy from the repository root. Databricks runs the root build command, which
builds `frontend/dist`, then launches:

```bash
python -m backend.main
```

See `docs/DATABRICKS_DEPLOYMENT.md` and
`docs/CLIENT_CONFIGURATION_CHECKLIST.md`.

## Human Review

All generated outputs are drafts requiring human review. Missing information is
flagged rather than invented, and funding recipient or investment vehicle roles
remain unresolved unless source evidence identifies them.
