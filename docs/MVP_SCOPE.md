# MVP Scope

## In Scope

- Upload or provide source strategy documents.
- Parse text-based TXT, PDF, DOCX, and PPTX files.
- Extract candidate investable concepts from source material.
- Assess each concept for evidence strength, readiness, and risk.
- Render either an Executive Investment Case or an Opportunity Spotlight from
  the same validated opportunity model.
- Surface citations, assumptions, and missing information at the claim level.
- Distinguish implementing organizations, capital-pathway entities, and
  beneficiary populations.

## Out of Scope

- Automated fundraising outreach.
- Claims that a specific organization should receive funds without source
  evidence.
- Legal, regulatory, or grant-compliance determinations.
- Final investor-ready materials without human review.
- Automated verification of facts outside the supplied source corpus.
- OCR-first support for image-only scans.
- Reliable interpretation of charts, diagrams, and complex tables.

## MVP Document-Processing Limits

### Supported input envelope

- Maximum file size: 25 MB per uploaded file.
- Maximum direct-processing length: 150 pages for PDF or DOCX, 150 slides for
  PPTX, or 250,000 characters for plain text.
- Preferred input type: text-based documents with an extractable text layer.

### Scanned and low-text PDFs

- Text-based PDFs are supported.
- Scanned PDFs without a usable text layer are not supported in the MVP.
- If extracted text density is too low, the app should block generation and
  show a clear message that the file appears to be scanned or image-based.

### Visual and table extraction limits

- The MVP should extract text and simple heading structure only.
- Captions or inline text that the parser can read may be retained.
- Charts, diagrams, page layout, and image semantics are not reliably
  extracted.
- Tables may degrade into plain text. Row and column semantics are not
  guaranteed.

### Long-document strategy

- Documents within the supported envelope should be chunked fully.
- Documents over the direct-processing limit should not silently truncate.
- For oversized documents, the system should stop and ask the user to shorten
  the file or split it into smaller source documents.
- A future iteration may add hierarchical or staged extraction, but that is not
  assumed for the MVP.

### User-facing errors and warnings

The UI should differentiate between blocking errors and cautionary warnings.

Blocking errors:

- unsupported file type
- file size over limit
- page or slide count over limit
- parse failure
- scanned or image-only PDF
- empty or near-empty extracted text

Warnings:

- low-confidence heading extraction
- likely degraded table extraction
- visuals or charts not interpreted
- conflicting source evidence
- unresolved funding-recipient or investment-vehicle information

## MVP Success Criteria

- Users can move from source document to candidate opportunities.
- Each candidate includes investability rationale and unresolved evidence gaps.
- Generated drafts follow the repository templates while using one canonical
  opportunity and evidence model.
- Outputs avoid fabricated figures, partners, funding gaps, timelines, and
  impact claims.
- Every factual, numerical, derived, or narrative statement in a draft is
  traceable through the claim model.
