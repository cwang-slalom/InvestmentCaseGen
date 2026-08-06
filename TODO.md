# TODO

## Sprint 3 Complete

- [x] Opportunity review/edit screen for core extracted fields.
- [x] Human-reviewed metadata for manually edited fields.
- [x] Citation preservation during core-field edits.
- [x] Organization-role detection with explicit unresolved states.
- [x] Funding-pathway detection without inferring funding recipient from
      sponsor, implementer, GPD, or the Gates Foundation.
- [x] Investability scorecard and readiness flags.
- [x] Citation validation foundation for unsupported numbers, unsupported role
      relationships, and conflicting role evidence.
- [x] Prompt loading and prompt-version metadata.
- [x] Optional model-backed extraction behind `ModelProvider`.
- [x] Unit coverage for Sprint 3 role, pathway, assessment, validation, prompt,
      test-provider, and edit behavior.

## Known Limitations

- [ ] Role and funding-pathway extraction is rule-based and pattern-based.
- [ ] Citation validation is not yet a full sentence-level claim verifier.
- [ ] Nested role, pathway, claim, beneficiary, and evidence-gap editing remains
      limited.
- [ ] Donor-facing generation requires a configured live model backend; no
      local fallback draft is produced.
- [ ] DOCX export is minimal and unbranded.
- [ ] Product-quality evaluation is heuristic until expert reviewer data exists.
- [ ] No browser automation e2e suite exists yet.

## Sprint 4 Complete

- [x] Generate Executive Investment Case drafts from reviewed opportunities.
- [x] Generate Opportunity Spotlight drafts from the same canonical model.
- [x] Validate generated draft claims against citations before persistence.
- [x] Persist donor-facing `DraftRecord` and `GenerationRun` metadata without
      raw responses by default.
- [x] Add UI for draft format selection, generation, validation warnings,
      evidence panels, product-quality evaluation, section regeneration, and
      DOCX export.
- [x] Add regression tests for donor-facing rendering, citation mapping,
      unresolved funding pathway rendering, segment tailoring, regeneration,
      DOCX export, and draft persistence.

## Proposed Sprint 5

- [ ] Move project, upload, extraction, review, draft generation,
      regeneration, and export endpoints into FastAPI.
- [ ] Replace the transitional Prisma/SQLite storage path with Postgres-backed
      backend storage.
- [ ] Update the Next.js frontend to call FastAPI through
      `NEXT_PUBLIC_API_BASE_URL`.
- [ ] Add optional model-backed donor-facing generation behind `ModelProvider`.
- [ ] Add stricter sentence-level citation validation and generation gating for
      unsupported critical claims.
- [ ] Add browser-level workflow tests for upload, extraction, review,
      generation, regeneration, evidence inspection, and DOCX export.
- [ ] Improve DOCX export with branded styles, citation footnotes/endnotes, and
      an evidence-gap appendix.
- [ ] Capture human product-quality review scores, notes, edit time, and
      draft-to-final diffs.
- [ ] Add nested editing for roles, pathways, claims, beneficiary populations,
      citations, and evidence gaps.
- [ ] Add comparison views across generated drafts and investor segments.
