# Phase 1 Implementation Notes

Date: 2026-08-05

## Lightweight Repository Preflight

Material findings:

- Reusable code retained: existing prompt guidance, domain guardrails, FastAPI
  provider configuration, backend prompt-loading tests, and concept-first
  documentation remain in the repository.
- Incompatible runtime bypassed: the previous primary UI used Next.js App
  Router route handlers and Prisma/SQLite persistence. The legacy Next route
  tree is archived at `legacy/next-app/` so tooling does not infer an active
  `src/app` Next workspace. Phase 1 now uses React/TypeScript/Vite with FastAPI
  serving the compiled frontend and all `/api/*` routes from one public process.
- Existing backend retained where useful: `/ai/structured` remains available
  for the transitional provider tests. The Phase 1 product workflow uses the
  new `GenerationBackend` boundary; new-opportunity drafts are deterministic
  outputs from uploaded extraction fields, while existing-library demo flows
  still use synthetic fixtures.
- Prisma, SQLite, Vercel-style frontend runtime, Turbopack, and external
  backend URLs are not required for Phase 1.
- No broad repository audit was performed. The preflight was scoped to existing
  frontend/runtime architecture, prompts, storage, deployment assumptions, and
  credential exposure risk.

## Assumptions

- Databricks Apps will deploy from the repository root.
- The client has not yet approved a specific model-serving endpoint, agent, or
  request payload contract.
- Uploaded documents are processed temporarily in Phase 1 and are not retained
  across application restarts.
- Synthetic opportunity, audience, project, source, generation, and review data
  remain acceptable for existing-library demo flows. New-opportunity uploads
  should parse text-layer PDFs or plain text and generate from reviewed
  extraction fields.

## Deferred Issues

- Production document parsing beyond plain text and text-layer PDF.
- Durable project and source storage.
- Live Databricks model or agent invocation mapping.
- Production export to DOCX or PowerPoint.
- Reviewer notifications and user-level authorization.
