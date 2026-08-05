# Databricks Apps Deployment

Phase 1 is designed as a Git-backed Databricks App with one browser-facing
process:

```text
Browser -> same-origin FastAPI -> /api/* -> GenerationBackend
```

FastAPI also serves the compiled React/Vite assets and the React-router
fallback for non-API routes.

## Repository Requirements

- Deploy from the repository root.
- Keep `package.json`, `package-lock.json`, `requirements.txt`, and `app.yaml`
  at the root.
- Keep `frontend/` for the Vite application and `backend/` for FastAPI.
- Do not configure Vercel, Cloud Run, Firebase, Supabase, or a separate API
  host for Phase 1.

## Root Build Behavior

Databricks detects the root `package.json`. The root build command is:

```bash
npm run build
```

That command runs the Vite build in `frontend/` and writes static assets to:

```text
frontend/dist
```

No production Node.js server is started after the build.

## Python Dependencies

Runtime Python dependencies are listed in root `requirements.txt`:

```text
fastapi
pydantic-settings
uvicorn
```

The app uses in-memory repositories for Phase 1.

## Startup

Root `app.yaml` launches:

```bash
python -m backend.main
```

`backend.main` reads:

- `UVICORN_HOST`, defaulting to `0.0.0.0`
- `UVICORN_PORT`
- `DATABRICKS_APP_PORT`
- local fallback port `8000`

No production port is hardcoded.

## Mock-Mode Deployment

Default deployment uses:

```text
MODEL_PROVIDER_MODE=deterministic
```

This enables the fully functional `MockGenerationBackend`; no Databricks
credentials or model endpoint are required for client access to the Phase 1
workflow.

## Future Model Resource Configuration

`DatabricksGenerationBackend` is present but intentionally returns
not-configured until the client approves:

- backend resource type
- endpoint or agent identifier
- request payload contract
- App identity permissions

The request mapping belongs behind `DatabricksRequestAdapter`. Do not hardcode
an endpoint name or endpoint-specific payload before approval.

## Logs And Verification

After deployment, inspect App logs from the Databricks Apps UI. Verify:

- FastAPI starts once.
- `/api/health` returns `status: ok`.
- Browser network calls target relative `/api/*` URLs.
- Static assets are served from the same origin.
- No privileged Databricks secrets appear in frontend assets or API responses.
