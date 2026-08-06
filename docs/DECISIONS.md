# Decisions and Open Questions

Planning checkpoint date: 2026-07-14

## Decisions

## 2026-08-06: Uploaded Sources Drive New-Opportunity Phase 1 Output

The "Create new opportunity" path now parses uploaded plain text and
text-layer PDFs in the FastAPI runtime and builds extraction fields from the
uploaded content. Generation for those projects uses the reviewed extraction
fields and their citations instead of the bundled vaccine demo fixture.

This remains deterministic Phase 1 generation rather than a final live-model
investment case. It must preserve unresolved fields when the source does not
identify a funding recipient, investment vehicle, role, figure, or timeline.
Uploaded bytes are processed in memory and are not durable source storage.

## 2026-08-06: Step 3 And Step 4 Detail Controls Are In-Page Drawers

Review setup controls and generation settings use the same right-side drawer
pattern as Step 2 detail controls. This keeps the user in the current wizard
context while making visible actions such as Edit setup, View all sources,
External web search, and View all settings perform observable work.

The generation page now treats results review as part of the Phase 1 workflow,
not a coming-soon placeholder. The View results action can trigger the mock
generation endpoint if needed, then navigates to the existing generated-output
review page.

The results page now supports minimal DOCX draft export in the Phase 1
FastAPI/Vite runtime. The export endpoint accepts the current visible output
payload so browser-held section edits are included. The file is intentionally
plain and draft-labeled; branded templates, citation footnotes or endnotes,
comments, PowerPoint export, and production persistence remain future work.

## 2026-08-06: Step 2 Detail Controls Use In-Page Drawers

The screenshot-style Step 2 controls for opportunity browsing, donor profile
review, suggestion customization, and output options open right-side drawers
inside the current wizard step. This preserves the user's selected concept,
audience, and output package while making every visible button perform an
observable action.

## 2026-08-05: Screenshot Refresh Keeps The Phase 1 Runtime

The screenshot-matched UI is implemented inside the existing React/Vite
frontend and FastAPI-backed Phase 1 runtime rather than introducing a new
frontend framework. The new Gates-styled shell, wizard cards, upload view,
extraction review, setup review, and generation progress screens remain wired
to the current typed API contracts and in-memory repositories.

The home route is a workspace dashboard rather than the first setup step. It
summarizes recent projects, recommended next actions, opportunity readiness,
and source/evidence health. The four-step workflow header appears only after a
user starts or opens a project flow.

## 2026-08-05: Screenshot Scenario Data Is Demo Fixture Content

Names and labels from the supplied screenshots, including HKJC, Vaccine
Development Platform, PST validation, and donor-output labels, are represented
as synthetic fixture data for UI fidelity. They do not establish a real funding
recipient, investment vehicle, investment manager, or delivery partner unless a
future approved source explicitly supports that role.

## 2026-08-05: Prompt Rules Are Split By Scope

The core agent prompt now contains only universal investment-case editing,
source-truth, factual-integrity, citation, behavioral-framing, and structured
output rules. Workspace-specific donor profile, timeline, UHNW commitment
level, global-health positioning, brand details, contacts, approved vehicles,
and benchmark examples live in `prompts/workspace-profile.example.yaml` or
future workspace records rather than the core prompt.

## 2026-08-05: Writer And Integrity Reviewer Are Separate Roles

Generation uses a writer prompt with the runtime case brief, approved fact
ledger, locked facts, required content, retrieved excerpts, selected template,
and current user instructions. Factual review uses a separate adversarial
reviewer contract that returns `pass`, `revise`, or `blocked` with findings
classified as `BLOCKING`, `WARNING`, or `EDITORIAL`. A reviewer pass means safe
for human review, not approved for external distribution.

## 2026-08-05: Memory Is Modeled As Scoped Approved Records

Longer-lived memory should be decomposed into ProductPolicy,
WorkspaceProfile, ProjectState, CaseKnowledge, and SessionInstruction records
instead of injecting a whole memory file into every prompt. Each memory item
must carry scope, category, source, source reference, approval status,
approver, timestamps, and optional expiry. Case facts remain case-scoped and
must not be reused across cases.

## 2026-08-05: Databricks Root Deployment Uses Backend Package Imports

The Databricks App is deployed from the repository root so the root build can
compile `frontend/dist` and `python -m backend.main` can start the FastAPI
process. Python modules under `backend/app/` therefore use package-relative
imports instead of assuming a top-level `app` package. Runtime dependencies use
plain `uvicorn`, because the app does not need WebSocket support and Databricks
base images can already include packages with tighter `websockets`
constraints.

## 2026-08-05: Phase 1 Uses Vite And FastAPI As The Single Public Runtime

The Phase 1 proof of concept uses React, TypeScript, Vite, FastAPI, and Python.
FastAPI serves the compiled React assets, owns all `/api/*` routes, and is the
only public runtime process for Databricks Apps. The prior Next.js route tree is
archived under `legacy/next-app/` and the root Next config files are removed so
Turbopack/Next workspace inference is not triggered. Prisma/SQLite-era support
code remains bypassed legacy work and is not part of the Phase 1 runtime.

## 2026-08-05: Production Databricks Generation Is Not Guessed

`MockGenerationBackend` is fully functional for Phase 1. At this checkpoint,
`DatabricksGenerationBackend` existed as a server-side integration seam and
returned not-configured until the client supplied the approved model-serving or
agent resource and request mapping. No endpoint name, request payload, token, or
client-specific Databricks identifier was hardcoded.

## 2026-08-06: UI Generation Uses The Databricks Claude Resource

The client has supplied a Databricks App Serving endpoint resource for Claude,
so the Phase 1 UI generation route now resolves the prior placeholder mapping.
The frontend continues to call `/api/projects/{projectId}/generate`; when
`MODEL_PROVIDER_MODE=databricks`, that backend route maps the project,
selected concept, audience, review setup, source excerpts, approved facts, and
locked facts into the existing backend-owned structured AI boundary.

`DatabricksGenerationBackend` reuses `DatabricksModelServingProvider` instead
of making a parallel provider implementation. This keeps Databricks App OAuth,
AI Gateway chat-completions payloads, prompt loading from `prompts/`, JSON
schema validation, source-grounding rules, and validated-output-only metadata
consistent with `/ai/structured`. The app still does not hardcode client
tokens; Databricks App runtime credentials or a local `DATABRICKS_TOKEN` must
provide access.

Root `app.yaml` now sets `MODEL_PROVIDER_MODE=databricks` and resolves
`DATABRICKS_MODEL_SERVING_ENDPOINT` from the Databricks App resource key
`serving-endpoint`, matching the client app resource instead of using the prior
deterministic default.

## 2026-08-04: Databricks Is A Supported Backend Runtime

For clients that only have Databricks available, the FastAPI backend can run as
a Databricks App. Live model calls should use Databricks Model Serving or
Foundation Model APIs through the same `/ai/structured` boundary instead of
requiring Vertex Gemini. Lakebase is the Databricks-native Postgres-compatible
persistence target for migrated FastAPI endpoints. The existing source-grounded
prompt, schema-validation, and validated-output-only rules still apply.

The first Databricks backend smoke test used a backend-only source folder, but
the Phase 1 app deployment now uses the repository root so Vite assets and the
FastAPI runtime are built and served from one app.

## 2026-08-03: Create Flow Uses A Four-Step Source-Grounded Wizard

The `/create` route now uses a four-step workflow aligned to the July 31, 2026
PRD and the revised Gates-styled frontend references: describe task, configure
opportunity and audience, review setup, and generate. The workflow remains a
real multipart form against `/api/investment-case` rather than a detached mock,
so source upload, extraction, generation, and review warnings still pass
through the existing MVP backend.

## 2026-08-03: One Source Package Can Generate Multiple Draft Outputs

The investment-case API now accepts multiple `outputTypes` and creates one
draft record per selected output from the same extracted Opportunity Card. This
supports the PRD requirement that one opportunity can produce coordinated
artifacts such as a deck, one-pager, talking points, full case, and source
appendix without creating separate extraction paths.

## 2026-08-03: PRD Output Types Are Added As Draft Profiles

Donor deck outlines, meeting talking points, and source appendices are now
typed output profiles in the domain library. They reuse the same source-backed
draft renderer, citations, claim validation, and human-review notice as other
formats. This keeps the frontend package UI honest while avoiding a separate
presentation engine in the MVP.

## 2026-07-30: Root Workspace Uses A Project Console Layout

The authenticated root route now opens on a project list. Selecting a project
loads a compact operating console at `/?projectId=...` with left navigation,
top project context, primary workflow actions, source document status,
opportunity review, generated draft preview, and background job status. This
matches the desired enterprise blue/white visual direction while keeping all
visible actions wired to real MVP routes or disabled when prerequisites are
missing.

## 2026-07-22: Source Uploads Use A Configurable File Store

Original uploaded source documents now go through a file-store interface. Local
disk remains the default development backend, while Google Cloud Storage is
enabled by `UPLOAD_STORAGE_BACKEND=gcs` and `GCS_UPLOAD_BUCKET`. The database
stores the resulting storage path plus source metadata and parsed evidence
records; it does not store the original binary document.

## 2026-07-22: Default Generation Is Prospectus-First

The default new-case output is now `Investment Prospectus` for a
`US Foundation Program Officer` audience. Executive Investment Case remains
available as a saved format, but the primary user flow should first attract
donor interest and support a follow-up diligence conversation before producing
full proposal-style materials.

## 2026-07-22: Saved Formats Start As A Typed Library

The MVP stores saved output formats in a typed application library rather than
adding a format-management database table. This keeps the first implementation
small and testable while preserving a clear migration path to a configurable
format knowledge base later.

## 2026-07-22: Narrative Variants Live In Draft Metadata

Saved narrative variants are represented by metadata inside
`DraftRecord.draftJson`, including variant label, format label, audience
profile label, narrative angle, and creation timestamp. This reuses the
existing draft persistence model and lets one opportunity accumulate multiple
audience-specific variants without schema churn.

## 2026-07-22: Prospectus Builder Inputs Are Framing, Not Evidence

Variant name, narrative angle, intended audience, call to action, positioning
notes, audience tailoring, and donor profile selection affect language,
structure, and emphasis only. They must not create source facts, citations,
funding recipients, impact figures, partners, timelines, regulatory status, or
cost estimates.

## 2026-07-22: Draft Review Separates Evidence Classes

Draft evidence panels separate source facts, generated framing, and unresolved
or weakly supported claims. This makes the product's concept-first guardrails
visible during human review and reinforces that investor-ready language remains
a draft until source-backed claims and open gaps are reviewed.

## 2026-07-21: Voice-To-Text Is A Browser-Native Input Aid

User text fields may offer dictation through the browser Web Speech API when
available. Dictation fills the same form fields as typed text, stops
automatically after silence, and does not create source evidence, citations, or
factual authority. Unsupported browsers should degrade to normal typing.

## 2026-07-13: Concept-First Product Framing

The product is framed around investable concepts rather than fundraising for a
single organization. Generated content must identify the most appropriate
funding recipient or investment vehicle from source evidence, or mark it as
unresolved.

## 2026-07-13: Reference Examples Are Style and Structure Inputs

Reference PDFs may be used to learn structure, narrative strength, evidence
density, and investment appeal. They are not fact sources and must not be
copied.

## 2026-07-13: Separate Implementation and Funding Fields

Templates include separate fields for implementing organizations and potential
funding recipients or investment vehicles because these roles may be held by
different entities.

## 2026-07-14: Re-Inspection Confirms Placeholder Assets Still Remain

The current files in `resources/reference-output-examples/` and
`resources/source-strategy-documents/building-blocks-to-thrive.txt` are still
placeholders. Planning can proceed, but real reference-pattern analysis and a
real source-to-output mapping remain blocked until those files are replaced.

## 2026-07-14: Root-Level Next.js Structure Is Already Correct

The application scaffold already exists at the repository root with App Router
routes under `src/app`. The implementation plan must preserve this structure
and must not create a nested Next.js project inside another application
directory.

## 2026-07-14: One Canonical Opportunity Model and One Pipeline

Executive Investment Case and Opportunity Spotlight are two renderers over the
same validated opportunity and evidence model. The system should use one
extraction pipeline and one assessment pipeline, not separate extraction logic
per output format.

## 2026-07-14: Draft Validation Is Claim-Level

Draft sections store structured claims separately from rendered markdown. Each
claim is classified, cited, and validated individually. Section markdown is a
presentation layer over claim-level evidence, not the source of truth.

## 2026-07-14: Beneficiary Is Not An Organization Role

Beneficiary information must be modeled separately from organization-role
relationships. Terms such as pregnant women, newborns, children under five,
people at risk of HIV, and health workers describe beneficiary populations, not
organizations.

## 2026-07-14: Organization Roles Are Entity-Only

`OrganizationRole` should only describe organizational entities and their
roles, such as concept owner, sponsoring team, implementing organization,
delivery partner, investment manager, or fiscal sponsor. Funding recipient and
investment vehicle details may require a separate capital-pathway structure when
they are not identical to a named organization.

## 2026-07-14: Funding Recipient Must Require Separate Evidence

A named implementing organization, sponsor, concept owner, delivery partner, or
document author is not enough evidence to name a funding recipient or
investment vehicle. Funding recipient, fiscal sponsor, and investment manager
must each have independent source evidence or be labeled unresolved.

## 2026-07-14: Generated Framing Is Not Source Fact

The system may improve narrative clarity and investor relevance, but generated
framing must be tracked separately from source-supported facts. Generated
phrases about urgency, leverage, or investor appeal must not introduce
unsupported facts, figures, timelines, partner names, cost estimates,
regulatory status, or impact claims.

## 2026-07-14: MoneyAmount Must Capture Context, Derivation, and Evidence

Money values in the MVP are not limited to a single scalar amount. The schema
must support ranges, geography, time period, cost type, unit basis,
per-beneficiary and per-period costs, derived values, calculation notes, and
citations.

## 2026-07-14: Raw Model Responses Are Off By Default

Generation logs must default to storing validated structured results and run
metadata only. Full raw model responses should not be persisted by default
because they may reproduce confidential source text, sensitive prompt content,
or uploaded file contents. Development-mode debugging may optionally store a
redacted response payload only.

## 2026-07-14: MVP Processing Limits Must Be Productized

The MVP should publish explicit limits for supported formats, file size, page
count, scanned PDF handling, visual extraction, table extraction, long-document
processing, and user-facing error behavior. Unsupported or low-confidence cases
must surface clear warnings instead of failing silently.

## 2026-07-14: Source Corpus Boundary

The MVP validates claims against uploaded source documents only. It should not
perform external fact checking or use reference outputs as factual sources.

## 2026-07-14: Evaluation Must Measure Product Quality, Not Only Pipeline Correctness

Parser, schema, citation, and end-to-end tests are necessary but insufficient.
The MVP also needs rubric-based product evaluation that answers whether the
generated draft is useful, persuasive, source-faithful, and faster to edit than
creating a manual first draft.

## 2026-07-14: Sprint 1 Uses Prisma 7 With SQLite And A Local Init Fallback

The foundation uses Prisma 7 schema/client generation with SQLite and the
`@prisma/adapter-better-sqlite3` driver adapter. The generated client remains
behind the storage abstraction.

In this environment, `prisma db push` validates the schema but fails during the
schema-engine apply step with an empty engine error. To keep local development
and CI checks repeatable, `npm run db:push` initializes SQLite from the
checked-in foundation migration through `better-sqlite3`, while `npm run
db:prisma:push` remains available to retry native Prisma push when the engine
issue is resolved.

## 2026-07-14: Sprint 1 Uploads Preserve Files Locally

Uploaded source files are retained under `data/uploads/`, which is ignored by
git. The database stores document metadata, parser status, warnings, and
chunk-level citation records. The app does not log full document contents.

## 2026-07-14: TXT Parsing Is Functional; Binary Parsers Are Interface Stubs

Sprint 1 implements the document parser interface for PDF, DOCX, PPTX, and TXT.
TXT parsing, validation, chunking, and citation creation are functional.
PDF/DOCX/PPTX uploads are recognized and persisted, but their parser adapters
return explicit failed-parser warnings until extraction libraries are selected.

## 2026-07-14: AI Generation Remains Behind An Interface

Sprint 1 adds the `ModelProvider` interface and deterministic mock provider for
future tests. No opportunity extraction, assessment, draft generation, or model
call path is implemented in Sprint 1.

## 2026-07-14: Sprint 2 Uses Deterministic Opportunity Extraction

Sprint 2 extracts candidate opportunities with deterministic chunk scoring over
parsed source text. It does not call a model, generate investor narrative, or
render Investment Cases. Extracted opportunities are review candidates with
source claims and evidence gaps.

## 2026-07-14: Sprint 2 Keeps Funding Pathway Unresolved By Default

The extraction pipeline does not infer a funding recipient or investment
vehicle from program, implementation, or donor language. When the source chunk
does not explicitly establish the funding pathway, the opportunity stores an
`unresolved_pathway` record and a funding-pathway evidence gap.

## 2026-07-14: Sprint 2 Parser Metadata Is Advisory

PDF page counts and PPTX slide counts are captured when available. DOCX page
count is not available from text extraction and is surfaced as a warning.
Visuals, charts, diagrams, layout semantics, and rich table structure remain
outside reliable MVP extraction.

## 2026-07-15: PDF Parsing Uses The Packaged PDF.js Worker

Next.js/Turbopack can rewrite `pdf-parse`'s default worker lookup to a missing
`.next` chunk. Server-side PDF parsing now sets `PDFParse`'s worker source to
the installed `pdf-parse/dist/worker/pdf.worker.mjs` file before extracting
text. This preserves text-layer PDF support without enabling OCR or visual
interpretation.

## 2026-07-14: Sprint 3 Edits Preserve Evidence Metadata

Manual review edits update the editable opportunity field value and status, but
preserve existing citation IDs by default. Edited fields are marked
human-reviewed with a review timestamp so source-supported facts, generated
framing, and human intervention remain distinguishable.

## 2026-07-14: Sprint 3 Uses Explicit Role And Pathway Evidence

Organization-role detection and funding-pathway detection are conservative and
source-grounded. A sponsor, concept owner, implementing organization, delivery
partner, GPD, or the Gates Foundation is not treated as the funding recipient
unless the source text separately establishes that capital pathway.

## 2026-07-14: Sprint 3 Assessment Can Permit Development Before Outreach

The investability assessment separates readiness for investment-case
development from readiness for investor outreach. A concept may be suitable for
draft development while still blocked from outreach by unresolved funding
recipient, investment vehicle, numerical, timeline, or organization-role
evidence.

## 2026-07-14: Sprint 3 Validation Is A Foundation, Not Final Claim Review

Citation validation now detects uncited factual fields, unsupported numbers,
unsupported organization-role and funding-pathway assertions, and conflicting
role evidence. Final donor-facing generation must still perform stricter
claim-level validation before producing exportable narratives.

## 2026-07-14: Sprint 3 Records Prompt Version And Generation Metadata

Prompts are loaded from `prompts/`, versioned from prompt content, and recorded
in `GenerationRun` with provider, model name, input chunk IDs, validation
result, status, and stored payload mode. Raw model responses remain off by
default.

## 2026-07-15: Sprint 4 Stores Validated Drafts As First-Class Records

Donor-facing outputs are persisted as `DraftRecord` objects containing a
runtime-validated `ValidatedDraft`. Sections, claims, citations, evidence gaps,
validation findings, product-quality evaluation, and narrative-change metadata
remain queryable after generation.

## 2026-07-21: Root UX Separates Dashboard From Creation

The root route is now the dashboard for histories and metadata. The upload and
one-click investment-case generation workflow lives at `/create`, with errors
redirecting back to that page. This preserves the MVP generation behavior while
making project history, draft history, source metadata, and unresolved
capital-pathway counts visible before starting new work.

## 2026-07-21: MVP Auth Uses Local Users, Sessions, And Project Memberships

The MVP uses first-party local authentication rather than adding an external
identity provider at this stage. Passwords are stored as scrypt hashes, browser
sessions use HTTP-only cookies backed by hashed session tokens, and project
access is represented by owner/editor/viewer memberships.

Owners and system admins can manage project access for existing users. Editors
can upload, review, extract, and generate within their projects. Viewers can
read allowed project data and export drafts, but cannot mutate source material,
opportunity reviews, or generated drafts.

This is an application-access decision only. Project membership must not be
interpreted as evidence that a user or their organization is the concept owner,
sponsoring team, implementing organization, investment manager, funding
recipient, delivery partner, beneficiary, investor, or donor audience.

## 2026-07-21: Microsoft SSO Is The Primary Configured Login Path

The login experience now prefers Microsoft Entra ID sign-in when
`MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` are configured. The app uses
the Microsoft identity platform authorization-code flow with PKCE, verifies the
returned ID token, and maps the Microsoft account email to a local user record.
If no local user exists for that email, the app creates an active member user
with no local password login.

The local password form remains available as a normal credential option, with
browser autocomplete fields and an optional longer remembered session.
Microsoft sign-in requests the Microsoft-hosted account picker so users can
choose among signed-in Microsoft accounts before returning to the application.
Production deployments should configure Microsoft sign-in and use project
memberships for access control.

## 2026-07-15: Good Grants Is A UI/UX Benchmark, Not A Clone Target

The MVP management surface should use Good Grants as a benchmark for compact
navigation, a black product bar, a narrow icon rail, high-density tables,
filtering/search/export controls, and explicit status columns. It should not
copy Good Grants' grant-management business model or visible product language.
The Investment Case Generator should adapt the pattern into an AI donor-case
studio with materials, investable concepts, donor outputs, narrative
strengthening, behavioral framing, visual briefs, and concept-first evidence
states. Funding recipient and investment vehicle status remain unresolved
unless uploaded source materials independently establish those roles.

## 2026-07-15: Visible Controls Must Be Real Affordances

Controls in the MVP should not be decorative. If a button, tab, icon, menu, or
toolbar action is visible, it must navigate, submit, export, open a menu, or
otherwise produce a meaningful outcome. Future placeholder capabilities should
be rendered as explanatory text or roadmap notes instead of inactive controls.

## 2026-07-15: AI Value Proposition Centers On Donor-Ready Transformation

The product goal is to use AI to pull foundation materials and Jenn's strong
starting point into donor-friendly investment cases. Generation should improve
narrative, donor-facing language, behavioral-science framing, and visual-story
guidance while preserving citations, source facts, unresolved evidence gaps,
and the distinction between implementer, funding recipient, investment vehicle,
delivery partner, beneficiary, and investor audience.

## 2026-07-15: Sprint 4 Uses Deterministic Renderers Before Model Authorship

Executive Investment Case and Opportunity Spotlight generation now render from
validated structured opportunity data. This keeps Sprint 4 source-faithful and
testable before introducing model-authored donor-facing prose.

## 2026-07-15: Sprint 4 Section Regeneration Revalidates The Draft

Regenerating a section refreshes the draft from the canonical opportunity,
increments section regeneration metadata, re-runs draft claim validation, and
recalculates product-quality evaluation.

## 2026-07-16: Default UX Is A One-Step Document Generator

The root app experience should not be a project-management dashboard. The
primary workflow is a single upload-to-draft path that turns an original source
document into a donor-friendly investment case with narrative strengthening,
behavioral framing, citations, evidence gaps, and visual-brief guidance.
Management pages remain as secondary inspection and recovery routes.

## 2026-07-15: Sprint 4 DOCX Export Is Minimal But Valid

DOCX export is implemented as a lightweight Word package using the existing zip
dependency. It exports draft sections and the claim registry, but branded
templates, footnotes, comments, and advanced document styling remain future
work.

## 2026-07-15: Sprint 4 Product-Quality Evaluation Is Heuristic

Automated product-quality evaluation is now available for fast feedback, but it
does not replace expert review. Human reviewer scores, notes, edit-time
tracking, and draft-to-final diff preservation remain planned evaluation work.

## 2026-07-15: Target Stack Is Next.js Frontend, FastAPI Backend, And Postgres

The long-term product stack is a Next.js frontend, a FastAPI backend, and a
Postgres database. Next.js should own the browser experience; FastAPI should own
API behavior, document processing orchestration, storage access, generation
workflows, validation, and export endpoints.

The current Next.js route handlers and Prisma-backed SQLite implementation are
transitional MVP paths. They may be used to keep existing workflows running
during migration, but new backend capability should be added to FastAPI and
persisted in Postgres rather than expanding the SQLite route-handler backend.

## 2026-07-15: Local FastAPI Development Should Invoke Uvicorn Via Python

Local backend startup should use `python -m uvicorn app.main:app --reload`
rather than a bare `uvicorn` command. This avoids PATH and shell-hash
mismatches that can accidentally launch a globally installed interpreter
without the backend virtualenv dependencies, including `psycopg`.

## 2026-07-16: Default Extraction Produces One Investment Case Output

The MVP should default to one investment case candidate per extraction run.
Source documents may contain several investment-relevant sections, but the app
should select the strongest source-grounded concept and expose that single
candidate for review and donor-facing draft generation unless the user
explicitly asks for comparison across multiple concepts.

## 2026-07-16: Live AI Is Optional And Must Preserve Deterministic Fallback

Live model behavior is available through the existing `ModelProvider`
interface, starting with a Vertex Gemini provider that reads local `.env`
configuration. Application routes should attempt live model-backed extraction
and bounded narrative strengthening only when configured, then fall back to the
deterministic pipeline if the model call, authentication, network request, or
schema validation fails.

Model outputs must still be parsed through typed schemas, citation-checked, and
stored as validated application records. Raw source text, prompt text, and raw
model responses should not be persisted by default.

## 2026-07-16: Gemini Authors Final Draft Language From A Source-Grounded Scaffold

The live model may author the final donor-facing section language when a Gemini
provider is configured. The deterministic renderer still creates the scaffold
that carries section keys, claim IDs, citations, evidence gaps, unresolved
funding-pathway language, and product validation metadata.

Gemini-authored draft output must preserve the scaffold's evidence structure.
The app rejects high-risk model edits that add unsupported new numbers or
resolve funding recipient or investment vehicle details that were unresolved in
the scaffold. After model-authored rendering and any additional strengthening,
the app must re-run draft claim validation and product-quality evaluation.

## 2026-07-16: Python Backend Owns Gemini Prompt Assembly

Live Gemini calls should flow through the FastAPI backend. The Next.js
transitional route handlers may continue to orchestrate scaffold creation,
storage, and fallback behavior, but they should not send prompt text to the
model provider. Instead, they send the operation, prompt name/version metadata,
business input, and the expected JSON schema.

The FastAPI backend loads the system prompt and operation prompt from
`prompts/`, assembles the Gemini request, parses JSON, validates model output
against the provided schema, and returns only validated output plus redacted
metadata. The direct TypeScript Vertex provider remains available only for an
explicit local/direct mode and is not the default live Gemini path.

## 2026-08-05: Claude Uses The Same Backend-Owned Prompt Boundary

Claude is supported as a first-class live model provider through the existing
FastAPI `/ai/structured` endpoint. The provider uses Anthropic's Messages API
with the repository system prompt supplied as the top-level system instruction
and the task prompt, schema, and business input supplied as one user message.

Claude output must follow the same invariants as Gemini and Databricks output:
parse JSON, validate against the caller-provided schema, preserve citation and
evidence structures, and persist only validated output plus redacted operational
metadata. External web search requests are recorded but not applied on the
Claude path.

## 2026-07-21: Donor Follow-Ups Are Proactive Review Inputs, Not Evidence

The product should proactively respond to donor follow-ups by updating the
working draft state, but a follow-up from a donor is not source evidence by
default. Follow-up handling must search existing cited claims, mark affected
sections, prepare suggested response language, and create evidence gaps for
unsupported requests about figures, funding recipients, investment vehicles,
partners, timelines, regulatory status, or impact claims.

The initial MVP implementation stores follow-up updates inside the validated
draft JSON rather than creating a separate database table. This preserves
backward compatibility for existing drafts while keeping follow-up history,
actions, warnings, and unresolved evidence needs reviewable.

## 2026-07-21: Audience Tailoring Changes Framing, Not Facts

Generated drafts can be tailored by investor segment, audience familiarity,
funding scale, narrative tone, and optional reviewer notes. These settings
control emphasis, structure, language, and visual-direction guidance only.

A "major donor" or "big bet" setting must not cause the system to invent scale,
funding gaps, cost estimates, impact figures, partners, timelines, readiness,
regulatory status, funding recipients, investment vehicles, or investment
managers. If the source material does not establish those details, the draft
must keep them unresolved while adapting the narrative for the selected
audience.

## 2026-07-21: Every Non-Dashboard Page Needs A Route Back To The Main Dashboard

The main dashboard at `/` is the canonical workspace home. Every
non-dashboard page in the MVP should expose a visible navigation action that
returns directly to that dashboard so users can recover global project context
without stepping back through project detail routes.

## 2026-07-21: External Web Search Is Per-Case And Opt-In

New case creation may expose an external web search toggle for live model
grounding. The default remains off so uploaded source documents continue to
define the factual corpus unless a reviewer explicitly opts in.

Even when external web search is enabled, generated drafts must keep the
existing source-fidelity rules: unresolved funding recipients, investment
vehicles, partners, timelines, regulatory status, impact figures, costs, and
funding gaps must stay unresolved unless evidence is available and reviewable.

## Working Assumptions

- The app is local-first for the MVP and does not require authentication.
- A single user can create and manage local projects.
- Uploaded source documents may contain confidential information, so complete
  documents should not be logged.
- Users can select an investor or donor segment, but segment choice changes
  emphasis and tone only, not factual content.
- A concept can be worth investment-case development even when it is not ready
  for investor outreach.
- A concept can be shown when funding recipient is unresolved, but the
  generated output must make that gap visible.
- DOCX export should include citations and evidence gaps, not just polished
  narrative prose.
- A deterministic mock model provider should be used for automated tests.
- Prompt markdown files in `prompts/` are the source of prompt text.
- The target runtime split is Next.js frontend, FastAPI backend, and Postgres
  persistence.
- FastAPI owns live Gemini prompt assembly and backend-side structured-output
  validation.
- Live AI is optional in the transitional Next.js route handlers and must not
  be required for local workflow completion.
- Donor follow-ups may drive proactive updates and response drafts, but they do
  not become factual evidence unless the user attaches or verifies source
  support through a separate review workflow.
- External web search during new-case drafting is opt-in and must not override
  source-corpus claim validation.

## Open Questions

1. What minimum evidence is required before the app may label an entity as a
   concept owner, sponsoring team, implementing organization, delivery partner,
   investment manager, funding recipient, fiscal sponsor, or investment
   vehicle?

2. What editing scope is required for nested organization roles,
   capital-pathway fields, claims, evidence gaps, and beneficiary populations
   beyond the Sprint 3 core-field editor?

3. If the source names an implementing organization but not a funding
   recipient, should the exported draft explicitly state that the implementer
   is not necessarily the recipient?

4. For donor-facing generation, which validation findings should block output
   entirely versus allow generation with prominent warnings?

5. What investor or donor segment should be the default when the user does not
   select one?

6. Should early-stage concepts with insufficient cost, timeline, and
   funding-gap evidence still be eligible for Executive Investment Case
   rendering, or only for Opportunity Spotlight rendering?

7. What citation granularity is expected in exported DOCX files: inline
   footnotes, endnotes, section-level source lists, or clickable source
   references?

8. Should exported documents include reviewer comments and validation warnings,
   or only reviewed draft content plus evidence gaps?

9. Should the app preserve uploaded source files on disk, store only extracted
   chunks, or support both with a retention setting?

10. What confidential-document handling expectations apply beyond not logging
    full raw responses, prompt text, or source text by default?

11. Is there an approved visual style, brand system, or document template for
    DOCX export, or should the MVP use a restrained unbranded style?

12. Should the system support concept comparison across multiple uploaded
    strategy documents in the MVP, or only within one project workspace?

13. Should generated outputs include explicit calls to action, and if so what
    forms are acceptable when the funding recipient or vehicle is unresolved?

14. Should source-supported estimates be labeled differently from exact figures
    in both UI and DOCX export?

15. Should the MVP allow users to add reviewer notes that become source-like
    evidence, or should notes remain separate from source evidence?

16. What is the manual first-draft baseline process for measuring edit effort
    and time saved fairly across reviewers?

17. Who qualifies as an expert reviewer for usefulness, persuasiveness, and
    source-faithfulness scoring in the MVP?

18. What branded DOCX template, citation style, and evidence-gap appendix
    structure should exported donor-facing drafts use?

19. Which donor-facing sections should be eligible for model-backed rewriting
    once deterministic rendering and validation are stable?

20. Should proactive follow-up updates require an explicit reviewer approval
    state before they appear in exported DOCX files?

21. What source-evidence attachment workflow should promote donor-provided
    materials or reviewer notes into the claim-validation corpus?
