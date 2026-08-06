# AI Backend And Output Flow

Update date: 2026-08-05

## Current Backend Reality

The current MVP has the AI boundary, backend-owned prompt package, and optional
live Claude, Vertex Gemini, and Databricks Model Serving paths in place.
Deterministic behavior remains the default fallback so the app still works
without network access or valid cloud credentials.

Important locations:

- `src/server/model-provider/` defines the model-provider interface and a
  deterministic mock provider.
- `src/server/uploads/files.ts` defines the original-source file-store
  boundary. Local disk remains the default, and GCS is enabled by
  `UPLOAD_STORAGE_BACKEND=gcs` plus `GCS_UPLOAD_BUCKET`.
- `src/server/model-provider/config.ts` resolves provider mode from `.env` and
  sends live model calls to the FastAPI backend when
  `NEXT_PUBLIC_API_BASE_URL` or `GENAI_BACKEND_BASE_URL` is configured.
- `backend/app/ai.py` owns the FastAPI `/ai/structured` endpoint and the
  backend-side live model call paths for Claude, Vertex Gemini, and Databricks
  Model Serving.
- `backend/app/prompts.py` maps operations to prompt files, loads the
  source-grounded system prompt and task prompt, and computes prompt versions.
- `backend/app/schema_validation.py` validates parsed model JSON against the
  schema supplied by the caller before output is returned.
- `src/server/model-provider/vertex-gemini.ts` implements the live Vertex
  Gemini provider over REST only for explicit direct/local mode.
- `prompts/` stores prompt text for the system instruction, extraction,
  assessment, investment-case generation, narrative strengthening, opportunity
  spotlight generation, and citation validation.
- `src/server/opportunities/extract.ts` attempts live model-backed opportunity
  extraction when a provider is configured, validates the structured response,
  and falls back to deterministic source-grounded extraction if the live path
  fails.
- `src/server/drafts/render.ts` builds a source-grounded scaffold with
  claim-level citations, donor-language guidance, behavioral framing, and
  visual-brief sections.
- `src/server/drafts/model-draft.ts` uses the configured live model to author
  the final section language from that scaffold. It preserves
  section keys, claim IDs, citation mappings, unresolved evidence gaps, and
  rejects high-risk model edits such as unsupported new numbers or resolved
  funding pathways that were unresolved in the scaffold.
- `src/server/drafts/model-strengthen.ts` applies optional model-backed
  narrative additions and visual/behavioral suggestions as generated framing,
  then re-runs draft validation and product-quality evaluation.
- `src/server/drafts/validation.ts` validates draft claims and citation
  support.

`GenerationRun` records are created for extraction and draft rendering so the
storage model can track provider, model name, prompt version, input chunk IDs,
validation result, and payload mode. Deterministic model names such as
`keyword-role-pathway-extractor-v1` and `source-grounded-draft-renderer-v1`
indicate fallback behavior. Live runs record the FastAPI backend provider plus
the configured Claude, Vertex, or Databricks model name.

Raw model responses are not persisted by default. The provider returns only
validated structured output and redacted operational metadata.

## AI Configuration

Default local behavior:

```bash
MODEL_PROVIDER_MODE="deterministic"
```

Live Vertex Gemini behavior through the Python backend:

```bash
GENAI_BACKEND_BASE_URL="http://localhost:8000"
MODEL_PROVIDER_MODE="backend"
```

Configure Vertex for the FastAPI backend process:

```bash
GOOGLE_CLOUD_PROJECT="your-gcp-project"
VERTEX_AI_LOCATION="global"
VERTEX_AI_MODEL="gemini-3.5-flash"
GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
```

Live Claude behavior through the Python backend:

```bash
GENAI_BACKEND_BASE_URL="http://localhost:8000"
MODEL_PROVIDER_MODE="anthropic"
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="<claude-model-id>"
```

The Claude provider uses Anthropic's Messages API with the backend-owned system
prompt in the top-level `system` field and the task/schema/input package as a
single user message. External web search requests are recorded in redacted
metadata but are not applied on the Claude path.

The Python backend also recognizes existing Google/Vertex-style variables
already used in local `.env` files:

- `GOOGLE_GENAI_USE_VERTEXAI`
- `GOOGLE_CLOUD_LOCATION`
- `LIVE_API_MODEL`
- `GOOGLE_OAUTH_ACCESS_TOKEN`
- `USE_MOCK_AI`

`USE_MOCK_AI=true` keeps application routes on deterministic behavior unless a
test explicitly allows the mock provider. The legacy TypeScript direct Vertex
provider is available only with `MODEL_PROVIDER_MODE=vertex-direct`.

Databricks-only client environments:

```bash
MODEL_PROVIDER_MODE="databricks"
DATABRICKS_HOST="https://<workspace-host>"
DATABRICKS_MODEL_SERVING_ENDPOINT="<endpoint-or-model-service-name>"
```

When running as a Databricks App, Databricks injects
`DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET`. For local development,
`DATABRICKS_TOKEN` can be provided instead. The Databricks provider uses the
same backend-owned prompt loading and schema-validation boundary as the Vertex
provider. External web search is not applied on the Databricks path.

## Upload-To-Output Flow

When a user uploads a source file:

1. `POST /api/projects/[projectId]/documents`
2. `src/server/documents/ingest.ts` validates and stores the file.
3. The original uploaded file is saved through the configured file store:
   local `data/uploads/[projectId]/` by default, or
   `gs://[GCS_UPLOAD_BUCKET]/[GCS_UPLOAD_PREFIX]/[projectId]/` when GCS upload
   storage is enabled.
4. Document metadata is stored in `SourceDocument`.
5. Parsed text chunks and citation anchors are stored in `SourceChunk`.

When a user extracts concepts:

1. `POST /api/projects/[projectId]/opportunities/extract`
2. If the FastAPI model backend is configured, parsed chunks are sent through
   the model provider with prompt metadata and a structured schema. The Python
   backend loads and injects the extraction prompt.
3. The response is parsed and validated against `OpportunitySchema`, assessed,
   citation-checked, and stored as an `OpportunityRecord`.
4. If the live call fails or returns no usable opportunity, parsed chunks are
   scored and converted by the deterministic extractor.
5. The UI shows the selected concept at `/projects/[projectId]/opportunities`.

When a user generates a donor-facing output:

1. `POST /api/projects/[projectId]/opportunities/[opportunityId]/drafts`
2. The renderer creates a source-grounded scaffold with sections, claims,
   citations, evidence gaps, narrative changes, behavioral framing, and a visual
   brief.
3. If the FastAPI model backend is configured, the live model authors the final
   section markdown from the scaffold while preserving the existing claim and
   citation registry. The Python backend loads and injects the generation
   prompt.
4. If the live render fails, the scaffold is stored as the deterministic
   fallback.
5. If narrative strengthening is enabled, the live model may add additional
   bounded framing suggestions after the main live render.
6. Draft claim validation and product-quality evaluation are re-run.
7. The result is stored as `DraftRecord`.
8. The UI shows it at
   `/projects/[projectId]/opportunities/[opportunityId]/drafts/[draftId]`.
9. DOCX export is available at
   `/api/projects/[projectId]/opportunities/[opportunityId]/drafts/[draftId]/export/docx`.

## PDF Limitation

Text-layer PDFs are supported. Charts, diagrams, images, and layout semantics
are not interpreted in the MVP parser. For those files, the output can include
a source-grounded visual brief, but it does not reconstruct or understand the
original visual design.
