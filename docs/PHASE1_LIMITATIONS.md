# Phase 1 Limitations

Phase 1 is UI-complete and integration-light.

Current behavior and limitations:

- Existing-library opportunities, audiences, source records, recent projects,
  and demo review findings are synthetic.
- New-opportunity uploads parse plain text and text-layer PDFs in memory.
  Extracted fields use the uploaded source text, with unresolved values where
  evidence is not found.
- Generated drafts require a configured live Databricks model backend. There
  is no deterministic or mock generation fallback.
- In-memory project state may survive browser refresh while the process runs,
  but it resets on application restart.
- File upload parsing currently supports plain text, Markdown, and text-layer
  PDFs. DOCX, PPTX, XLSX, OCR, scanned PDFs, charts, diagrams, and complex
  tables are not production parsed in this runtime.
- Uploaded bytes are parsed in memory and are not retained after extraction.
- No durable document storage is implemented.
- No external web search is performed.
- No production database is used.
- No reviewer notifications or approval workflow automation are implemented.
- Minimal DOCX draft export is implemented from the current visible output
  payload. No branded production DOCX or PowerPoint export is implemented.
- `DatabricksGenerationBackend` maps the reviewed UI project state into the
  structured model request, but it still requires approved Databricks endpoint
  configuration and credentials at runtime.

Future intended pattern:

- Unity Catalog Volume for approved source documents.
- Client-approved Lakebase, Delta, or SQL storage for project records.
- Client-approved Databricks Model Serving or agent backend for generation.
