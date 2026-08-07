# Codex Build Prompt

Use this as the clean baseline prompt when asking Codex to continue building
the app. It describes the product and codebase in their intended current
state. Do not include historical bug reports, superseded architecture, or
pre-fix behavior in this reusable prompt.

## Prompt

You are helping build the Investment Case Generator MVP.

### Product goal

Build a concept-first application that helps users inspect source strategy
documents, identify investable concepts, and turn one selected concept into
source-grounded donor- and investor-ready draft materials for human review.

### Critical business rule

The product is concept-first, not organization-first.

Do not assume that GPD, the Gates Foundation, the sponsoring team, or the app
user is the funding recipient.

Always distinguish between:

- concept owner
- sponsoring team
- implementing organization
- investment manager
- funding recipient
- delivery partner
- beneficiary
- investor or donor audience

If the source material does not identify the funding recipient or investment
vehicle, keep it unresolved. Never infer it without evidence.

### Active architecture

Build on the current Phase 1 runtime only:

- `frontend/`: React, TypeScript, Vite single-page app
- `backend/app/`: FastAPI API and server-side runtime
- FastAPI serves the built frontend and all `/api/*` routes from one public
  process
- uploaded-source parsing, extraction, generation orchestration, and DOCX
  draft export live in the FastAPI runtime
- live model generation goes through backend-owned prompts in `prompts/` and
  validated structured outputs
- the active runtime is still lightweight and in-memory for much of the
  project state, while generated outputs require a configured live model
  backend

Do not reintroduce or extend superseded architecture unless explicitly asked:

- `legacy/next-app/`
- root `src/`, Prisma, and related earlier scaffolding

These remain reference material, not the active app path.

### Current product behavior

The app should let users:

1. create or open a project
2. describe the task and upload source material
3. extract and review candidate opportunity details from text-based source
   documents
4. select the opportunity, audience, and output package
5. review setup, evidence, and unresolved gaps
6. run live generation and review results
7. export a draft document for human editing

Support source-grounded drafting only. Missing facts must be surfaced as
unresolved, not invented.

### Source and evidence rules

- Inspect source documents before generating content.
- Use uploaded source material and approved project facts as the source of
  truth.
- Preserve citations and traceability.
- Never fabricate impact figures, cost estimates, funding gaps, partners,
  regulatory status, timelines, or role assignments.
- Clearly separate source facts from generated narrative framing.
- If source evidence conflicts, surface the conflict instead of guessing.
- Treat all generated output as draft content requiring human review.

If you are unsure whether something is a source-backed fact or generated
framing, treat it as unresolved until evidence supports it.

### MVP limits

- Prefer text-based documents with extractable text.
- Support plain text and text-layer PDFs in the active flow.
- Do not assume OCR, chart interpretation, image understanding, or reliable
  table semantics.
- If a document is scanned, image-only, empty, or over limits, block or warn
  clearly instead of proceeding silently.

### Engineering rules

- Read existing files before changing code.
- Prefer small, testable changes that fit the current architecture.
- Keep prompts in `prompts/`.
- Validate model responses with typed schemas.
- Keep model-provider and storage logic behind interfaces.
- Do not expose secrets.
- Do not add unnecessary frameworks or infrastructure.
- Maintain `docs/PLAN.md` and `docs/DECISIONS.md` when the plan or
  architecture changes.
- Preserve the existing visual and product direction unless explicitly asked to
  redesign it.

### Definition of done

Before considering work complete:

- run `npm run check`
- run `cd backend && .venv/bin/python -m pytest`
- confirm the affected user flow still works
- document any limitations that remain

### Working style

When you fix a problem, update the system to its corrected state. Do not
preserve error-ridden instructions or historical bug context inside the main
build prompt. Keep this prompt clean, current-state, and reusable.
