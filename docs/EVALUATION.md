# Evaluation

## Evaluation Goal

The MVP needs two complementary evaluation tracks:

- engineering correctness: does the pipeline parse, validate, cite, and render
  reliably?
- product quality: does the draft help a human create a persuasive,
  source-faithful investment document faster and with less effort?

Automated tests are necessary, but they do not answer whether the product is
actually useful.

## Evaluation Tracks

### 1. Engineering Correctness

This track is covered by automated tests and deterministic fixtures.

- parser normalization
- schema validation
- citation validation
- organization-role validation
- beneficiary-population validation
- unsupported-number detection
- unresolved funding-recipient behavior
- renderer correctness for both output modes
- export checks
- end-to-end happy path

### 2. Product Quality

This track is covered by rubric-based human review on real source documents once
the placeholder materials have been replaced.

Sprint 4 adds an automated product-quality scorecard for generated drafts. It
is useful as an immediate warning system for citation coverage, role
distinction, unresolved-gap visibility, completeness, and edit readiness, but it
is not a substitute for expert review.

## Product-Quality Scorecard

| Metric | Definition | MVP target |
| --- | --- | --- |
| Factual support rate | Share of factual claims whose validation status is `supported` or correctly marked unresolved/conflicting | 100% |
| Numerical claim citation rate | Share of numerical claims with at least one direct supporting citation | 100% |
| Organization-role accuracy | Share of reviewed outputs that keep concept owner, sponsor, implementer, manager, funding recipient or vehicle, and beneficiary distinct | 100% |
| Unsupported claim rate | Share of claims judged unsupported after review | 0% |
| Completeness | Share of required sections and required opportunity fields that are substantively filled or explicitly unresolved | >= 90% |
| Source faithfulness | Reviewer score for fidelity to the source and honest labeling of unresolved information | >= 4/5 |
| Expert usefulness | Reviewer score for usefulness as a working first draft | >= 4/5 |
| Investor persuasiveness | Reviewer score for how compelling the document is for the intended investor or donor audience without overstatement | >= 4/5 |
| Edit effort | Reduction in rewrite burden compared with a manual first draft baseline | Material reduction |
| Time saved | Reduction in elapsed draft-development time compared with a manual first draft baseline | >= 40% |
| Evidence-gap accuracy | Share of major missing facts correctly surfaced as gaps rather than invented claims | >= 90% |

## Metric Notes

- `Factual support rate` is calculated from the claim registry, not from section
  markdown alone.
- `Unsupported claim rate` includes factual, numerical, derived, and narrative
  statements that imply unsupported facts.
- `Completeness` should not reward fabricated filler. Explicit unresolved labels
  count as complete handling when evidence is genuinely absent.
- `Investor persuasiveness` should reward clarity, specificity, and appropriate
  capital framing, not hype.

## Reviewer Rubric

Use a 1-5 scale for the subjective dimensions:

- `1`: unusable or misleading
- `2`: weak, requires major rewrite
- `3`: partially useful, requires substantial editing
- `4`: strong draft, requires moderate editing
- `5`: very strong draft, requires light editing only

Reviewer prompts:

- `Source faithfulness`: Did the draft stay loyal to source material and avoid
  unsupported facts?
- `Expert usefulness`: Would a domain expert meaningfully benefit from starting
  with this draft?
- `Investor persuasiveness`: Does the document make a credible case for further
  investor or donor interest without overstating evidence?
- `Evidence-gap accuracy`: Did the system identify the important missing cost,
  role, funding, timeline, and implementation gaps?

## Evaluation Artifacts To Preserve

For every reviewed generation run, preserve:

- source document set and document version
- extracted opportunity
- assessment output
- validated draft sections
- claim registry
- human-edited final draft
- draft-to-final diff
- reviewer scorecard
- reviewer notes
- timing data for AI-assisted drafting and manual-baseline comparison
- model name, prompt version, and minimal operational metadata

Do not persist raw model responses by default as part of evaluation storage.

## Review Workflow

1. Run automated validation first.
2. Route only validation-passing drafts to expert review.
3. Ask the reviewer to edit the draft into an acceptable final version while
   recording elapsed time and major rewrite effort.
4. Capture the scorecard and notes.
5. Save the validated draft, final draft, diff, scores, and timing data.
6. Analyze recurring edit patterns to identify schema, prompt, and UX changes.

## Dataset Strategy

Use two dataset types:

- deterministic fixtures for engineering tests
- real source documents for product-quality review

The current repository still contains placeholder source files, so product
evaluation cannot begin credibly until those files are replaced.

## Sprint 4 Automated Evaluation Status

Implemented automated checks:

- factual support proxy from draft citation-validation status
- citation coverage for factual, numerical, and derived draft claims
- role-distinction warning for sponsor/funding-recipient confusion
- unresolved evidence-gap visibility
- section completeness
- source-faithfulness proxy from validation status
- donor-persuasiveness proxy from segment tailoring and narrative strengthening
- edit-readiness warning based on validation blockers

Still requires human review:

- whether the narrative is strategically compelling for a real donor audience
- whether the selected investor segment is appropriate
- whether the document is easier to edit than a manual first draft
- whether the DOCX format matches reviewer and stakeholder expectations
- whether all important missing evidence has been surfaced
