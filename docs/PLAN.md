# Investment Case Generator MVP Plan

Planning checkpoint date: 2026-07-14

## 2026-08-06 UI Claude Generation Wiring

- Route the Phase 1 UI generation API through the Databricks Model Serving
  structured provider when `MODEL_PROVIDER_MODE=databricks`.
- Reuse the backend-owned prompt loading, Databricks App OAuth, AI Gateway chat
  completions, JSON schema validation, and validated-output-only metadata
  boundary already used by `/ai/structured`.
- Keep the frontend API contract stable: the Generate page continues to call
  `/api/projects/{projectId}/generate`, but that route now receives Claude
  output instead of the Databricks placeholder in configured Databricks Apps.
- Add focused backend tests proving both initial UI generation and section
  regeneration call the Databricks Claude structured provider.
- Remove deterministic/mock generation fallbacks. If the live model backend is
  not configured, generation and regeneration return a not-configured error
  instead of producing demo output.

## 2026-08-06 Uploaded Source Parsing And Source-Grounded Generation

- Replace uploaded-file mock extraction in the Phase 1 FastAPI runtime with
  real in-memory parsing for plain text and text-layer PDFs through `pypdf`.
- Build extracted fields from uploaded source text instead of synthetic vaccine
  fixtures, with unresolved values where source evidence is not found.
- Send reviewed extraction fields, citations, unresolved evidence gaps,
  selected audience, approach setup, and selected outputs into the live model
  request for "Create new opportunity" projects.
- Existing-library opportunity, audience, and source records remain synthetic
  demo inputs, but they are no longer used to produce deterministic generated
  outputs.
- Keep source documents temporary in Phase 1; uploaded bytes are parsed in
  memory and are not durable project storage.

## 2026-08-06 Review Setup And Results Clickability Fix

- Wire Step 3 review setup affordances from the screenshot refresh:
  field-level setup editing, full customization details, reviewer management,
  internal-source review, and external web-search details all open in-page
  drawers.
- Wire Step 4 generation settings review through the same drawer pattern so
  users can inspect all settings and return to setup for changes.
- Replace the disabled "View results (coming soon)" state with a real results
  action that only becomes usable when live model generation is configured.
- Replace the disabled "Export future phase" result affordance with a minimal
  Phase 1 DOCX draft export from the current visible output payload, including
  local section edits, citations, information-needed items, and integrity
  findings.

## 2026-08-06 Opportunity Setup Interaction Fix

- Wire the Step 2 detail affordances for viewing all opportunities, opening the
  selected donor profile, customizing system suggestions, and reviewing all
  output options.
- Keep the interactions in-page through the existing drawer pattern so the
  user does not lose the current opportunity, audience, or output selections.

## 2026-08-05 Screenshot-Matched Frontend Refresh

- Rework the Phase 1 Vite frontend to match the supplied Gates Foundation
  Investment Case Generator screenshots across the home/task, opportunity and
  audience, new opportunity upload, extraction review, review setup, and
  generation progress screens.
- Keep the existing four-step workflow and FastAPI API contracts intact while
  replacing the visual shell, stepper, cards, action controls, and generated
  progress views.
- Treat the home route as a workspace dashboard with recent work,
  recommendations, opportunity pipeline, and evidence-health summaries. The
  four-step setup header belongs to the project creation flow after users start
  a new project.
- Update synthetic demo fixtures to use the screenshot scenario names and
  labels, including HKJC, Vaccine Development Platform, PST validation status,
  and coordinated donor outputs.
- Preserve the concept-first guardrail in the UI copy: demo content supports
  product visualization only and does not identify an inferred funding
  recipient or investment vehicle.

## 2026-08-05 Prompt And Memory Architecture Update

- Replace the short source-grounding prompt with a full core agent prompt for
  philanthropic investment-case editing, including source-of-truth rules,
  instruction priority, factual integrity, required content preservation,
  behavioral framing, citation discipline, and the structured writer output
  contract.
- Keep workspace-specific details out of the core prompt. Store audience,
  brand, organization vocabulary, contacts, approved vehicles, benchmark
  cases, and governance rules in a separate workspace profile.
- Standardize runtime task inputs around document type, case title, user goal,
  target length, document state, case brief, approved fact ledger, locked
  facts, required content, source excerpts, template, and current user
  instructions.
- Use an independent adversarial factual-integrity reviewer prompt for
  validation decisions instead of relying only on the writer's self-check.
- Document the target memory split into ProductPolicy, WorkspaceProfile,
  ProjectState, CaseKnowledge, and SessionInstruction objects, with approval
  metadata on each stored memory record.

## 2026-08-05 Claude Provider Update

- Add Claude as a first-class live model option through the existing FastAPI
  `/ai/structured` boundary, using Anthropic's Messages API.
- Preserve backend-owned prompt loading, caller-supplied JSON schema
  validation, and validated-output-only persistence. The active Phase 1 UI
  generation route was later changed to live-model-only with no deterministic
  fallback draft.
- Keep the TypeScript route layer provider-agnostic: Claude, Vertex Gemini, and
  Databricks Model Serving all flow through the same `BackendModelProvider`
  when `GENAI_BACKEND_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL` is configured.
- Do not commit live Anthropic credentials. Local Claude runs require
  `MODEL_PROVIDER_MODE=anthropic`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL`.

## 2026-08-05 Phase 1 Databricks Apps Vertical Slice

- Fix Databricks root deployment startup by using package-relative imports
  inside `backend.app` and avoiding optional Uvicorn WebSocket dependencies
  that conflict with Databricks preinstalled packages.
- Build the Phase 1 proof of concept as a React/TypeScript/Vite frontend served
  by FastAPI from one public process.
- Replace the runtime dependency on Next.js route handlers and Prisma/SQLite
  for the Phase 1 journey with in-memory repositories and `/api/*` FastAPI
  routes.
- Implement the complete wizard: describe task, opportunity and audience,
  extraction review for new opportunities, review setup, generation progress,
  and generated-materials review.
- Use only synthetic opportunities, audiences, sources, projects, extraction
  results, generated outputs, and review findings at that checkpoint. Uploaded
  source extraction and generation behavior were later changed so real uploads
  parse source text and generation requires the live model backend.
- Prepare `GenerationBackend`, `CaseRepository`, `OpportunityRepository`,
  `AudienceRepository`, and `SourceProcessor` interfaces for later production
  replacements.
- Keep Databricks model invocation behind a not-configured adapter until the
  client approves endpoint type, resource identifier, payload contract, and App
  identity permissions.

## 2026-08-04 Databricks Backend Update

- Add Databricks as a supported backend runtime for client environments where
  Databricks is the only available platform.
- Keep FastAPI as the backend boundary, but allow `/ai/structured` to call
  Databricks Model Serving or Foundation Model APIs when
  `MODEL_PROVIDER_MODE=databricks`.
- Keep Vertex Gemini support for non-Databricks environments.
- Add backend-only Databricks App packaging files under `backend/` and document
  that the deployed app folder must also include `prompts/`.
- Make database URL resolution prefer Lakebase-style `PG*` environment
  variables over the local development Postgres default.
- Preserve the core product guardrails: backend-owned prompt assembly,
  structured schema validation, source-grounded evidence rules, and validated
  outputs only.

## 2026-08-03 Implementation Update

- Re-read the July 31, 2026 PRD and revised the create experience around the
  PRD's source-grounded, opportunity-first, human-reviewed workflow.
- Replace the older `/create` single-page setup form with a Gates-styled
  four-step workflow:
  - describe task
  - select source materials, audience, and outputs
  - review narrative, evidence, and review setup
  - generate the output package
- Add first-class MVP output types for donor deck outlines, meeting talking
  points, and source appendices, alongside existing one-pagers, concept notes,
  board briefs, executive cases, prospectuses, and spotlights.
- Update `/api/investment-case` so one uploaded source package can generate
  multiple coordinated draft records from the same extracted Opportunity Card.
- Preserve the existing backend evidence boundary: source upload, parsing,
  opportunity extraction, claim validation, draft generation, and review/export
  controls still use typed schemas and storage interfaces.
- Keep Opportunity Library, donor profiles, knowledge base, and template
  navigation visible as product structure, while the live generation path still
  depends on controlled source upload for the MVP.

## 2026-07-30 Implementation Update

- Restyle the authenticated root workspace around a project-first operating
  console inspired by the provided reference screenshot: fixed left navigation,
  project header, three primary workflow actions, source/opportunity/draft
  review columns, and a compact job-status band.
- Revise the Projects tab so `/` is a project list first. Selecting a project
  opens the detail console at `/?projectId=...`, instead of automatically
  showing the most recently updated project.
- Shift the visual system from green-accented management surfaces to a cooler
  blue/white enterprise palette with restrained borders, dense panels, and
  separate green/orange status states for completion and warnings.
- Preserve existing source-grounding behavior and real workflow affordances.
  Upload, extraction, generation, draft review, and DOCX export controls still
  route through the existing project, opportunity, and draft endpoints.

## 2026-07-22 Implementation Update

- Add a configurable source-upload file-store boundary. Local disk remains the
  default for development, and Google Cloud Storage can now store original
  source documents when `UPLOAD_STORAGE_BACKEND=gcs` and `GCS_UPLOAD_BUCKET`
  are configured. The database continues to store metadata, parser status,
  chunks, citations, opportunities, and drafts.
- Shift the default generation experience toward an investment prospectus
  rather than a traditional proposal. New case creation now defaults to
  `Investment Prospectus` for a `US Foundation Program Officer` audience.
- Add a typed saved format library for:
  - Investment Prospectus
  - Donor One-Pager
  - Concept Note
  - Board Brief
  - High-Net-Worth Donor Teaser
  - Executive Investment Case
  - Opportunity Spotlight
- Add US donor-oriented audience profiles, including US foundation program
  officer, US major donor, and donor-advised fund advisor.
- Add concept prospectus builder metadata to generated drafts: variant name,
  narrative angle, intended audience, call to action, and positioning notes.
  These controls are framing inputs only and are not treated as source
  evidence.
- Preserve saved narrative variants by storing variant metadata in the existing
  `DraftRecord.draftJson` payload. This avoids a new database table for the
  MVP while keeping the shape typed and migration-ready.
- Separate evidence review on draft pages into source facts, generated
  framing, and unresolved or weakly supported claims.

## 2026-07-21 Implementation Update

- Add browser-native voice-to-text support to user-entered text fields across
  the Next.js UI, including case metadata, review edits, audience tailoring,
  donor follow-ups, and dashboard search.
- Keep voice transcription as a frontend input aid only. Transcribed text uses
  the existing form fields and remains human-entered draft input, not source
  evidence.
- Auto-stop dictation after a short silence interval so users do not need to
  manually end every recording session.

## Checkpoint Scope

This checkpoint revises the plan only. It does not begin application
implementation.

The goals of this revision are to:

- re-inspect the repository after the requested source-material swap
- revise the architecture around one canonical opportunity model
- strengthen evidence modeling to the claim level
- document MVP document-processing limits and evaluation criteria
- update the planning package so implementation can start only after approval

## Re-Inspection Result

The repository root already contains a Next.js App Router scaffold at
`src/app`. No nested Next.js project should be created inside another
application directory.

However, the requested source-material replacement has not happened in the
current workspace state:

- `resources/source-strategy-documents/building-blocks-to-thrive.txt` is still
  the placeholder text file.
- `resources/reference-output-examples/lenacapavir-executive-summary.pdf` is
  still a one-page placeholder PDF.
- `resources/reference-output-examples/maternal-newborn-health-spotlights.pdf`
  is still a one-page placeholder PDF.

Because the actual files are still placeholders, this checkpoint can finalize
the revised model, workflow, and evaluation plan, but it cannot truthfully
produce:

- a real structural analysis of the Lenacapavir reference example
- a real structural analysis of the Maternal & Newborn Health reference example
- a real Building Blocks to Thrive source-to-output map
- real candidate investable concepts grounded in that source

Those three analyses remain blocked until the real files are present.

## Current Repository State

- `src/app/` contains the root-level Next.js shell that should remain the
  canonical application location.
- `prompts/` contains prompt drafts for extraction, assessment, generation,
  strengthening, and citation validation.
- `resources/templates/` contains one Executive Investment Case template and
  one Opportunity Spotlight template.
- `docs/` contains planning, evaluation, scope, and decision notes.
- `tests/` still contains placeholders only and no executable test suite.

## Revised Planning Conclusions

### 1. One canonical opportunity model and one pipeline

The MVP should not use separate extraction pipelines for Executive Investment
Case and Opportunity Spotlight generation.

The pipeline should be:

1. parse documents
2. normalize chunks and citations
3. extract candidate opportunities into one canonical `Opportunity` model
4. assess readiness, risks, and evidence gaps on that same model
5. render either:
   - Executive Investment Case
   - Opportunity Spotlight

The renderers should differ in structure, emphasis, and presentation only. They
must read from the same validated opportunity and evidence store.

### 2. Claim-level evidence is mandatory

A draft section must not be represented as only `bodyMarkdown` plus a section
source list. The canonical draft model must store:

- section structure
- a claim registry
- claim-to-citation mapping
- validation status per claim
- unresolved evidence gaps

Rendered markdown is a presentation layer over validated claims, not the source
of truth for factual support.

### 3. Organization roles and beneficiary populations must be separate

`OrganizationRole` should model only organizational entities. Beneficiary
populations must be stored in a separate `BeneficiaryPopulation` structure.

To keep capital framing precise, the revised schema package also separates
organizational roles from capital-pathway records such as funding recipient or
investment vehicle when those are not clearly equivalent to a named
organization.

### 4. MoneyAmount needs evidence-aware richness

Money fields must support:

- single values
- ranges
- geography
- time period
- cost type
- per-beneficiary or per-period unit basis
- derived values
- calculation notes
- citations and validation status

### 5. Raw model responses should not persist by default

The default persistence boundary should include only:

- validated structured outputs
- minimal operational metadata
- redacted error information when needed

If development-mode raw capture is ever enabled, it must store only a redacted
payload and must not retain full prompt text, full source text, or uploaded
document contents.

### 6. Reference examples remain non-evidentiary

Reference outputs may be used only for:

- structure
- narrative quality
- risk framing
- evidence density
- presentation patterns

They must never be used as factual evidence for a newly generated opportunity.

### 7. MVP document-processing limits must be explicit

The MVP needs clear boundaries for supported formats, size, page counts,
scanned-document handling, table and visual extraction, and user-facing warning
behavior. Those limits are now defined in `docs/MVP_SCOPE.md`.

## Reference Example Analysis Status

The current actual files are still placeholders, so detailed reference-pattern
analysis is not yet possible. The re-inspection findings are documented in:

- `docs/REFERENCE_EXAMPLE_ANALYSIS.md`

That document records the concrete observable properties of the placeholder
files and the exact areas that remain blocked pending the real PDFs.

## Source-To-Output Mapping Status

The current actual Building Blocks source file is still a placeholder, so no
credible investable concept can be extracted from it. The current source audit
and mapping status are documented in:

- `docs/SOURCE_TO_OUTPUT_MAPPING.md`

That document records the real current state of the source file, the unresolved
output fields, and the mapping approach that should be reused once the full
source text is present.

## Proposed TypeScript Schemas

The revised schema proposal has been moved into its own review artifact:

- `docs/PROPOSED_SCHEMAS.ts`

Key schema changes in this revision:

- one canonical `Opportunity` model
- one `OpportunityAssessment` model
- one `ValidatedDraft` model shared by both renderers
- claim registry with citation and validation metadata
- separate `OrganizationRole`, `BeneficiaryPopulation`, and `FundingPathway`
  models
- expanded `MoneyAmount`
- minimal `GenerationRecord` metadata with raw-response capture off by default

## Revised Application Structure

The target stack is now:

- Next.js frontend at the repository root
- FastAPI backend under `backend/`
- Postgres as the system database

The existing Next.js App Router structure should remain the frontend location.
No nested Next.js project should be created inside a legacy `app/` folder or
another child directory. Current Next.js route handlers and Prisma/SQLite
storage are transitional implementation details and should be migrated into
FastAPI instead of expanded as the long-term backend.

## Revised Implementation Sequence After Approval

1. Preserve the existing root-level Next.js scaffold and add shared domain
   modules under `src/`.
2. Implement runtime-validated schemas from `docs/PROPOSED_SCHEMAS.ts`.
3. Implement document ingestion with the MVP limits defined in
   `docs/MVP_SCOPE.md`.
4. Implement normalized citations and chunk records.
5. Implement one extraction pipeline that writes canonical `Opportunity`
   objects.
6. Implement one assessment pipeline that writes readiness, risk, and
   evidence-gap records against those opportunities.
7. Implement one draft validation pipeline that produces claim-level evidence
   records plus renderer-specific sections.
8. Implement the two renderers over the same validated opportunity and claim
   models.
9. Persist only validated outputs and minimal operational metadata by default.
10. Add engineering tests and the product-quality evaluation workflow described
    in `docs/EVALUATION.md`.

## Review Package Updated In This Checkpoint

- `docs/PLAN.md`
- `docs/DECISIONS.md`

## 2026-07-21 UX Dashboard Update

The root page now serves as a dashboard-style workspace rather than a combined
landing page and upload form. The dashboard should remain the entry point for:

- recent donor-facing draft history
- project/case history
- source, concept, draft, citation, generation-run, and evidence-gap metadata
- unresolved capital-pathway visibility
- navigation into source documents, concepts, uploads, drafts, and DOCX export

The one-click source-to-draft workflow moved to `/create`. This keeps the
existing generation feature intact while making "Create new case" a focused
page with a back path to the dashboard.

## 2026-07-21 Auth And Project Access Update

The MVP now requires sign-in before dashboard, creation, project, document,
opportunity, draft, export, and generation workflows.

Access is scoped by project membership:

- owner: view, edit, generate, upload, and manage project access
- editor: view, edit, generate, and upload
- viewer: view allowed project data and export allowed drafts

System admins can see all projects so historical/local MVP work remains
recoverable. Existing projects are assigned to the bootstrap admin during local
SQLite initialization, while newly created projects make the creator an owner.

This access model controls who can view or modify project workspaces only. It
does not imply that any signed-in user, GPD, or the Gates Foundation is the
funding recipient, implementing organization, concept owner, investment
manager, delivery partner, beneficiary, investor, or donor for an extracted
investment case.

## 2026-07-21 Microsoft Sign-In Update

Microsoft sign-in is now the preferred login path when Microsoft Entra ID
settings are configured:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID` optional, defaults to `organizations`
- `MICROSOFT_REDIRECT_URI` optional, defaults to the app origin plus
  `/api/auth/microsoft/callback`

The login page presents Microsoft sign-in and password login as normal choices.
It uses the Microsoft account email to find or create the local application
user, and the password form uses browser autocomplete fields plus a remembered
session option. The Microsoft redirect requests `prompt=select_account` so
Microsoft presents its hosted account picker when multiple accounts are
available.

## UI/UX Benchmark Update

Update date: 2026-07-15

Good Grants is now the UI/UX benchmark for the MVP management experience, but
it should be adapted rather than cloned. The current implementation should
prioritize:

- a compact AI donor-case studio rather than a marketing-style landing page
- black product navigation with a narrow icon rail
- dense, sortable-feeling tables for source materials, investable concepts,
  donor outputs, funding-pathway status, and draft workflow
- visible filters, search, workflow actions, export affordances, and display
  counts
- explicit unresolved states for funding recipient and investment vehicle when
  source evidence does not identify them
- product-specific language around materials, concepts, cases, narrative
  strengthening, behavioral framing, and visual briefs

The benchmark source scan found public Good Grants product screenshots and
official feature pages for manage and auto-scoring workflows. Where public
screenshots are incomplete, the user-provided Good Grants screenshot should be
used as the primary visual reference for layout density and affordance
patterns, not as an exact business model or visual skin.

## Product Interaction Correction

Update date: 2026-07-15

The management UI should not present decorative controls as clickable product
features. Every visible button, navigation item, and action affordance should
either:

- submit a real form
- navigate to an existing workflow
- open a real menu with links
- download/export a real artifact
- be rendered as plain explanatory text rather than a button

## Product Scope Correction

Update date: 2026-07-16

The default app experience should be a direct document-generation workflow, not
a complex management dashboard.

The primary user path is now:

1. upload one original foundation/source document
2. create a project automatically when needed
3. parse and chunk the uploaded source
4. extract one candidate investable concept
5. generate a donor-facing investment case draft
6. open the generated draft with DOCX export available

The root page should therefore prioritize a single "generate document" form
with output type, donor audience, and narrative-strengthening options. Existing
project, document, opportunity, and review pages can remain available as deeper
inspection and recovery surfaces, but they should not define the default user
experience.

The primary product goal is AI-assisted transformation of foundation materials
and Jenn's strong starting point into donor-friendly investment cases. The UI
and prompts should emphasize:

- pulling foundation materials into the workspace
- identifying source-grounded investable concepts
- strengthening narrative and donor-facing language
- applying behavioral-science framing without inventing facts
- producing a visual brief or visual guidance for human review
- preserving citations, unresolved funding pathways, and human-review status

- `docs/EVALUATION.md`
- `docs/MVP_SCOPE.md`
- `docs/REFERENCE_EXAMPLE_ANALYSIS.md`
- `docs/SOURCE_TO_OUTPUT_MAPPING.md`
- `docs/PROPOSED_SCHEMAS.ts`

## Planning Exit Criteria

This planning checkpoint should be considered ready for approval only when the
reviewer agrees with:

- the root-level Next.js structure
- the single canonical opportunity pipeline
- claim-level evidence as the draft source of truth
- the separation of organization roles, funding pathways, and beneficiary
  populations
- the expanded money model
- the raw-response storage boundary
- the MVP processing limits
- the evaluation plan

Implementation should not begin until this revision is approved.

## Sprint 1: Project Foundation Execution

Sprint 1 began after planning approval on 2026-07-14.

Implemented foundation scope:

- preserved the root-level Next.js App Router application
- added runtime-validated shared schemas under `src/domain/`
- configured local SQLite persistence with Prisma schema/client generation
- added a Prisma-backed storage abstraction under `src/server/storage/`
- added project persistence and source-document persistence
- added document upload API routes
- added document parsing interfaces for PDF, DOCX, PPTX, and TXT
- implemented TXT parsing, source chunking, and citation-backed chunks
- added file retention under local `data/uploads/`
- added a ModelProvider interface and deterministic mock provider
- replaced the placeholder shell with a project dashboard, upload page, and
  source document list
- added Vitest unit tests, ESLint, Prettier checks, TypeScript checking, and a
  CI-friendly `npm run check` command
- updated README setup instructions

Not implemented in Sprint 1:

- opportunity extraction
- investability assessment
- AI generation
- draft rendering
- DOCX export
- full binary text extraction for PDF, DOCX, and PPTX

Sprint 1 parser boundary:

- TXT parsing is functional.
- PDF, DOCX, and PPTX uploads are recognized and persisted, but parser adapters
  currently return explicit failure warnings until extraction libraries are
  selected and wired.

Sprint 1 persistence note:

- Prisma 7 requires datasource URLs in `prisma.config.ts` and a driver adapter
  in the generated client.
- In this local environment, `prisma db push` validates the schema but fails at
  the schema-engine apply step with an empty engine error. The repository keeps
  `npm run db:prisma:push` for retrying native Prisma push, and `npm run
db:push` initializes the local SQLite database from the checked-in foundation
  migration using `better-sqlite3`.

## Sprint 2: Document Intelligence Execution

Sprint 2 implemented document intelligence without Investment Case generation.

Implemented scope:

- added text-layer parsing for PDF, DOCX, PPTX, TXT, and Markdown text inputs
- added parser metadata for word count, character count, text density, headings,
  and available page or slide counts
- kept explicit warnings for visual, chart, layout, table, and page-count
  limitations
- enriched source chunks with page, slide, section-heading, and word-count
  metadata
- added a deterministic source-chunk scoring pipeline for candidate opportunity
  extraction
- persisted canonical `Opportunity` records with source claims, unresolved
  funding pathway, and evidence gaps
- added opportunity extraction API routes and a candidate opportunity review UI
- added migration tracking for the local SQLite initializer
- added tests for parser metadata, PPTX extraction, storage persistence, and
  opportunity extraction

Not implemented in Sprint 2:

- Investment Case generation
- donor- or investor-ready narrative rendering
- Opportunity Assessment scoring
- model-backed extraction
- DOCX export
- prompt-loading utilities

Sprint 2 extraction boundary:

- Extraction is deterministic and conservative.
- Funding recipient and investment vehicle remain unresolved unless future
  source-grounded logic identifies them with evidence.
- Candidate opportunities are review objects, not final recommendations.

## Sprint 3: Opportunity Intelligence and Investability Assessment Execution

Sprint 3 implemented opportunity intelligence without Executive Investment
Case or Opportunity Spotlight generation.

Implemented scope:

- added opportunity review and editing for key extracted fields
- preserved citation metadata during user edits and marked edited fields as
  human-reviewed
- added field status handling for source-provided values, derived values,
  generated framing, unresolved fields, and conflicting evidence
- added source-grounded organization-role detection for concept owner,
  sponsoring team, implementing organization, delivery partner, investment
  manager, and fiscal sponsor
- added funding-pathway detection for explicit funding recipient, fund manager,
  implementer, investment vehicle, pooled fund, fiscal sponsor vehicle,
  government program, nonprofit, research institution, product developer, and
  other vehicle cues where source wording supports them
- kept funding recipient and investment vehicle unresolved unless source text
  explicitly establishes the pathway
- added the required unresolved pathway message:
  "Not established in the provided source materials."
- implemented `OpportunityAssessment` / `InvestabilityAssessment` scoring over
  the approved investability criteria
- added readiness level, strengths, weaknesses, missing evidence, recommended
  next steps, investment-case readiness, and investor-outreach readiness
- added citation validation for uncited factual fields, unsupported numbers,
  unsupported organization-role relationships, unsupported funding pathways,
  and conflicting role evidence
- added prompt loading from `prompts/` with content-based prompt versioning
- added `GenerationRun` persistence for prompt name, prompt version, provider,
  model name, input chunk IDs, validation result, status, and stored payload
  mode
- added optional model-backed extraction behind `ModelProvider`, with validated
  structured outputs and no raw model-response persistence by default
- added opportunity review UI with organization-role table, funding pathway
  section, investability scorecard, evidence gaps, citation/conflict findings,
  and readiness status
- added tests for role distinction, unresolved funding recipient behavior,
  funding pathway extraction, assessment scoring, unsupported number detection,
  conflicting evidence, prompt loading/versioning, mock model extraction, and
  user edits preserving evidence metadata

Not implemented in Sprint 3:

- Executive Investment Case generation
- Opportunity Spotlight generation
- final donor-facing narrative generation
- DOCX export
- external fact checking
- polished model-provider integrations beyond the interface-compatible optional
  model-backed extraction path

Sprint 3 limitations:

- organization-role and funding-pathway detection is deterministic and
  pattern-based
- citation validation detects foundational issues but is not yet a full
  sentence-level claim verifier
- conflict detection is scoped to repeated organization-role assertions with
  different named organizations for the same role type
- users can edit core opportunity fields, but full manual editing for every
  nested role, pathway, claim, and evidence-gap object remains future work
- no browser automation e2e suite exists yet; relevant end-to-end confidence is
  currently provided by the Next.js production build plus storage and pipeline
  tests

## Sprint 4: Donor-Facing Investment Case Generation Execution

Sprint 4 implemented donor-facing draft generation over the validated canonical
opportunity and evidence model.

Implemented scope:

- added persisted `DraftRecord` objects containing validated draft JSON
- added Executive Investment Case rendering over `Opportunity`,
  `OpportunityAssessment`, claims, citations, roles, funding pathways, and
  evidence gaps
- added Opportunity Spotlight rendering over the same model
- added section-level claim mapping through `DraftSection.claimIds`
- added claim-to-citation mapping through the draft claim registry
- added deterministic narrative strengthening that preserves facts and
  citations
- added investor-segment tailoring for general donors, philanthropic
  foundations, impact investors, government donors, and corporate philanthropy
- added draft generation UI on the opportunity review page
- added draft review UI with validation status, product-quality scorecard,
  narrative changes, generated sections, regeneration controls, and evidence
  panels
- added section regeneration with refreshed validation and product-quality
  evaluation
- added DOCX export using the existing lightweight zip dependency
- added deterministic product-quality evaluation for factual support, citation
  coverage, role distinction, unresolved-gap visibility, completeness, source
  faithfulness, donor persuasiveness, and edit readiness
- recorded `GenerationRun` metadata for rendering, regeneration, and export
  without persisting raw model responses
- added tests for draft rendering, claim/citation mapping, unresolved funding
  pathway rendering, segment tailoring, section regeneration, DOCX export, and
  draft persistence

Not implemented in Sprint 4:

- model-authored donor-facing narrative generation
- full sentence-level semantic citation verification
- browser automation e2e tests
- rich DOCX styling, comments, tracked changes, footnotes, or template branding
- human reviewer score capture and draft-to-final diff persistence

Sprint 4 limitations:

- donor-facing generation is deterministic and conservative
- narrative strengthening uses fixed segment-specific framing rather than a
  model-backed rewrite
- DOCX export is a valid minimal Word package, not a polished branded export
- product-quality evaluation is automated and heuristic until real reviewer
  scorecards are collected

## 2026-07-15 Maintenance: PDF Upload Parsing Fix

- fixed server-side PDF uploads under Next.js/Turbopack by configuring
  `pdf-parse` with its packaged PDF.js worker file
- added regression coverage for text-layer PDF extraction and sliced uploaded
  buffers
- verified the MNH spotlight PDF upload parses into page metadata and
  citation-backed chunks
- OCR, visual extraction, chart interpretation, and layout semantics remain out
  of MVP scope

## 2026-07-16 Maintenance: Single Output Extraction

- changed the default extraction behavior to prepare only one investment case
  candidate per extraction run
- kept the strongest source-grounded concept by deterministic score when one
  uploaded document contains multiple investment-relevant sections
- updated the extraction prompt and model-backed schema to request and validate
  a single concept output
- updated the concepts page copy so the user sees one selected concept for
  review and draft generation, not a multi-concept comparison surface
- added regression coverage that one source document with multiple candidate
  sections still produces one output

## 2026-07-16 Maintenance: Optional Live AI Integration

- added a Vertex Gemini `ModelProvider` implementation that uses existing
  Google/Vertex `.env` variables and validates structured outputs with Zod
- added provider-mode resolution for live model-backed behavior without
  exposing secrets
- wired opportunity extraction to attempt live model-backed extraction when
  configured, then fall back to deterministic extraction on network,
  authentication, or validation failure
- wired draft generation to apply optional model-backed narrative
  strengthening as generated framing only, followed by draft claim validation
  and product-quality evaluation
- kept raw model-response persistence off by default; only validated outputs
  and generation metadata are stored
- added tests for provider configuration, Vertex request/response handling,
  model-backed extraction schema validation, and safe draft strengthening

## 2026-07-16 Maintenance: Gemini-Authored Draft Rendering

- changed donor-facing draft generation so a configured Gemini provider authors
  final section markdown from the validated deterministic scaffold
- preserved the scaffold's section keys, claim IDs, citation mappings,
  unresolved evidence gaps, validation, and product-quality evaluation flow
- added guards that keep original scaffold text when Gemini introduces
  unsupported new numbers or resolves funding recipient / investment vehicle
  fields that were unresolved in source-grounded evidence
- kept deterministic rendering as the fallback when Gemini rendering fails
- added regression coverage for Gemini-authored section text and guarded
  fallback to scaffold language

## 2026-07-16 Maintenance: Python-Owned Gemini Prompt Assembly

- added a FastAPI prompt registry that maps model operations to prompt markdown
  and computes prompt versions from prompt content
- moved the source-grounded system instruction into `prompts/` so Python loads
  it for Gemini calls instead of relying on caller-provided prompt text
- changed the FastAPI Gemini provider to assemble system prompt, task prompt,
  schema, and business input server-side
- added backend-side structured-output validation against the JSON schema
  supplied by the caller before returning model output
- changed the TypeScript FastAPI model-provider client and model-backed
  extraction/drafting calls so prompt text is stripped from request input
- made the FastAPI backend the default live Gemini path; the direct TypeScript
  Vertex provider now requires explicit direct mode

## 2026-07-21 Maintenance: Proactive Donor Follow-Up Updates

- added draft-level donor follow-up intake so reviewers can paste donor
  questions, objections, diligence asks, or requested edits into an existing
  donor-facing draft
- added validated `DonorFollowUpUpdate` records inside `ValidatedDraft` with
  topics, impacted sections, source-backed claim references, unresolved
  evidence requests, actions, warnings, and suggested donor-response language
- added deterministic follow-up handling that searches existing cited claims,
  marks unsupported high-risk requests as evidence gaps, appends a donor
  follow-up updates section, flags impacted draft sections, and re-runs claim
  validation and product-quality evaluation
- added a draft API route and review-page UI for applying follow-up updates
- kept donor follow-ups separate from factual source evidence unless supporting
  material is uploaded or reviewer-verified separately

## 2026-07-21 Maintenance: Audience Tailoring Controls

- added typed audience tailoring for donor-facing drafts covering audience
  familiarity, funding scale, narrative tone, and optional reviewer notes
- exposed tailoring controls in both the upload-to-draft workflow and the
  reviewed-opportunity draft-generation panel
- stored tailoring settings inside `ValidatedDraft` JSON with backward
  compatible defaults for existing drafts
- wired deterministic rendering, model-authored drafting, and model-backed
  narrative strengthening to use the same tailoring object
- kept audience tailoring as emphasis, structure, and tone guidance only; it
  must not introduce new facts, figures, partners, funding recipients,
  investment vehicles, timelines, or impact claims
- displayed the selected tailoring lens on generated draft review pages and in
  draft lists

## 2026-07-21 Maintenance: Explicit Return To Dashboard Navigation

- added a visible `Back to dashboard` action to every non-dashboard app page,
  including upload, documents, opportunities, opportunity review, and
  donor-facing draft screens
- kept the main dashboard at `/` as the canonical workspace home so users can
  return to the full project list and recent draft activity from any project
  route without stepping backward through intermediate pages

## 2026-07-21 Maintenance: Per-Case External Web Search Toggle

- added an opt-in external web search checkbox to the `/create` case setup
  form
- passed the setting through the one-click investment-case route and the shared
  draft-creation path
- added `externalWebSearch` to the model-provider request contract and wired
  FastAPI-backed and direct Vertex Gemini providers to include Google Search
  grounding tools only when the setting is enabled
- kept opportunity extraction source-only and preserved existing draft
  validation rules so web grounding does not silently resolve unsupported
  funding recipients, investment vehicles, partners, figures, or timelines

## Proposed Sprint 5 Plan

Sprint 5 should split the product along the target stack while preserving the
source-grounded generation behavior already implemented.

1. Move project, document, opportunity, review, generation, regeneration, and
   export API behavior from Next.js route handlers into FastAPI endpoints.
2. Replace the transitional Prisma/SQLite persistence path with Postgres-backed
   storage behind typed FastAPI service boundaries.
3. Update the Next.js frontend to call the FastAPI API through
   `NEXT_PUBLIC_API_BASE_URL`.
4. Expand model-backed donor-facing generation beyond framing-only additions
   only after stricter sentence-level validation and blocking rules are in
   place.
5. Add stricter sentence-level draft claim validation and generation gating for
   unsupported critical claims.
6. Add browser-level workflow tests for upload, extraction, review, generation,
   regeneration, evidence inspection, and DOCX export.
7. Improve DOCX export with template styles, citation footnotes or endnotes,
   evidence-gap appendix, and reviewer-ready formatting.
8. Add human product-quality review capture, including reviewer scores, notes,
   edit-time tracking, and draft-to-final diff preservation.
9. Add manual editing for nested draft claims, citations, roles, funding
   pathways, and evidence gaps.
10. Add comparison views across generated drafts and investor segments.
11. Extend proactive follow-up handling with optional model-backed
    classification, source-evidence attachment, reviewer approval states, and
    donor-specific change history once sentence-level validation is stricter.
