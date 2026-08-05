# InvestmentGen FastAPI Backend

This is the backend target for the stack migration:

- Next.js frontend
- FastAPI backend
- Postgres database

## Local Development

From the repository root:

```bash
docker compose up -d postgres
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m uvicorn app.main:app --reload --port 8000
```

Using `python -m uvicorn` avoids PATH and shell-hash mismatches with any
globally installed `uvicorn` binary.

Health endpoints:

- `GET /health` confirms the API process is running.
- `GET /ready` confirms the API can reach Postgres.
- `POST /ai/structured` runs structured Gemini generation through the backend
  when Vertex configuration is present, or Databricks Model Serving generation
  when `MODEL_PROVIDER_MODE=databricks` is configured.

The existing Next.js route handlers still power the current MVP workflow while
their backend logic is migrated into FastAPI. Gemini model calls now route
through this FastAPI backend first when `NEXT_PUBLIC_API_BASE_URL` points at the
backend.

Prompt assembly for model calls is backend-owned:

- Prompt markdown is loaded from the repository `prompts/` directory by
  `backend/app/prompts.py`.
- The caller sends `operation`, `promptVersion`, `metadata.promptName`, business
  input, and a JSON schema. It does not send prompt text.
- The backend injects the system prompt and operation prompt into Gemini,
  parses JSON, validates the output against the provided schema, and returns
  only validated output plus redacted generation metadata.

## Databricks Apps

For a Databricks-only client environment, create a clean Databricks App source
folder containing `app/` copied from `backend/app/`, `app.yaml`,
`requirements.txt`, and the repository's top-level `prompts/` directory. The
included `app.yaml` starts FastAPI with Uvicorn, and `requirements.txt` lists
the Python dependencies Databricks should install.

Required live AI configuration:

```bash
MODEL_PROVIDER_MODE="databricks"
DATABRICKS_HOST="https://<workspace-host>"
DATABRICKS_MODEL_SERVING_ENDPOINT="<endpoint-or-model-service-name>"
```

If the prompt files are not deployed beside the app, set
`INVESTMENTGEN_PROMPTS_DIR` to their absolute runtime path. See
`../docs/DATABRICKS_DEPLOYMENT.md` for the full deployment notes.
