# Phase 1 Limitations

Phase 1 is UI-complete and integration-light.

Current limitations:

- All opportunities, audiences, source records, recent projects, extraction
  results, generated outputs, and review findings are synthetic.
- In-memory project state may survive browser refresh while the process runs,
  but it resets on application restart.
- File upload accepts PDF, DOCX, and TXT in the UI, but Phase 1 uses mock
  extraction rather than production binary parsing.
- Uploaded bytes are written only to a temporary server file and deleted in a
  `finally` block.
- No durable document storage is implemented.
- No external web search is performed.
- No production database is used.
- No reviewer notifications or approval workflow automation are implemented.
- No production DOCX or PowerPoint export is implemented.
- `DatabricksGenerationBackend` is a prepared integration seam only. It does
  not guess endpoint names or payload formats.

Future intended pattern:

- Unity Catalog Volume for approved source documents.
- Client-approved Lakebase, Delta, or SQL storage for project records.
- Client-approved Databricks Model Serving or agent backend for generation.
