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

## Claude Resource Deployment

Default Databricks App deployment now uses the approved Serving endpoint
resource:

```text
MODEL_PROVIDER_MODE=databricks
DATABRICKS_MODEL_SERVING_ENDPOINT=<valueFrom: serving-endpoint>
```

The app resource key must match the Databricks Apps resource configuration. In
the current client app, the resource key is `serving-endpoint` and the endpoint
is the Claude-serving Databricks endpoint. Databricks Apps also injects
`DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, and `DATABRICKS_CLIENT_SECRET` so the
backend can authenticate as the app service principal.

## Model Resource Configuration

`DatabricksGenerationBackend` maps the UI generation contract to Databricks
Model Serving after the client-approved resource is available:

- backend resource type
- endpoint or agent identifier
- request payload contract
- App identity permissions

The request mapping remains behind `DatabricksRequestAdapter`. Do not hardcode
tokens or client-specific endpoint names; the endpoint name must continue to
come from the App resource environment variable.

## Logs And Verification

After deployment, inspect App logs from the Databricks Apps UI. Verify:

- FastAPI starts once.
- `/api/health` returns `status: ok`.
- `/api/config` reports `mode: live` and backend provider
  `databricks-generation-backend` with `status: ok`.
- Browser network calls target relative `/api/*` URLs.
- Static assets are served from the same origin.
- No privileged Databricks secrets appear in frontend assets or API responses.
