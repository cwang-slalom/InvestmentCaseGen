# AI Backend And Output Flow

Update date: 2026-08-06

## Current Backend Reality

The active Phase 1 runtime is React/Vite served by FastAPI. Donor-facing
generation is live-model-only:

- `/api/projects/{projectId}/generate` uses `DatabricksGenerationBackend` only
  when `MODEL_PROVIDER_MODE=databricks` or a Databricks alias is configured.
- If the live Databricks backend is not configured, generation and section
  regeneration return a not-configured error. The app does not create a
  deterministic or mock donor-facing draft.
- Uploaded `.pdf`, `.txt`, and `.md` sources are parsed in memory. Text-layer
  PDF parsing uses `pypdf`; scanned or image-only PDFs are rejected.
- Reviewed extraction fields, selected audience, selected outputs, review
  setup fields, locked facts, and source excerpts are sent into the structured
  model request.
- Raw model responses are not persisted by default. The provider returns
  validated structured output and redacted operational metadata.

Important locations:

- `backend/app/services/generation.py` selects the active UI generation
  backend.
- `backend/app/backends/databricks_backend.py` maps Phase 1 project state into
  backend-owned structured AI requests.
- `backend/app/backends/model_required_backend.py` is the explicit
  not-configured backend used when live generation is not available.
- `backend/app/ai.py` owns the generic FastAPI `/ai/structured` live-provider
  boundary for Claude, Vertex Gemini, and Databricks Model Serving.
- `backend/app/services/extraction.py` owns text-layer PDF and plain-text
  parsing for the Phase 1 upload flow.
- `prompts/` stores prompt text for source-grounded extraction, investment-case
  generation, and factual-integrity review.

## AI Configuration

Default local behavior disables draft generation:

```bash
MODEL_PROVIDER_MODE="model_required"
```

Databricks UI generation:

```bash
MODEL_PROVIDER_MODE="databricks"
DATABRICKS_HOST="https://<workspace-host>"
DATABRICKS_MODEL_SERVING_ENDPOINT="<approved-endpoint-or-model-service-name>"
```

When running as a Databricks App, Databricks injects
`DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET`. For local development,
`DATABRICKS_TOKEN` can be provided instead.

The generic `/ai/structured` endpoint can still be used by backend tests and
transitional integrations for live Claude, Vertex Gemini, or Databricks calls,
but the Phase 1 UI generation route is Databricks-backed and does not fall back
to local draft generation.

## Upload-To-Output Flow

When a user uploads a source file in the active Phase 1 UI:

1. `POST /api/sources/extract?projectId=...&filename=...`
2. FastAPI parses uploaded text or text-layer PDF bytes in memory.
3. The app builds extraction fields with citations and unresolved placeholders
   where the source does not identify a fact.
4. The user reviews and confirms extracted fields.
5. `PUT /api/projects/{projectId}/review-setup` saves audience, output, and
   approach setup.
6. `POST /api/projects/{projectId}/generate` sends the reviewed project state
   into the live Databricks model request.
7. If live generation succeeds, validated outputs are stored in memory for the
   current process and shown in the results page.
8. If live generation is not configured or fails, no donor-facing draft is
   produced.
9. DOCX export is available only for the visible generated output payload at
   `/api/projects/{projectId}/exports/docx`.

## PDF Limitation

Text-layer PDFs are supported. Charts, diagrams, images, scanned pages, and
layout semantics are not interpreted in the MVP parser.
