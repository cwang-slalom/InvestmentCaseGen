# Generate Investment Case Prompt

Use this prompt as the runtime task instruction for investment-case generation.
Transform the selected source-grounded opportunity into the requested
donor-facing saved format while preserving source fidelity.

## Instructions

Use the structured input payload as:

- `documentType`: the requested document type.
- `caseTitle`: the case name.
- `userGoal`: the current user goal.
- `targetLength`: the target length.
- `currentDocumentState`: `NEW_DRAFT`, `REVISION`, or `DIAGNOSTIC_ONLY`.
- `caseBrief`: the case brief.
- `approvedFactLedger`: approved case facts.
- `lockedFacts`: facts that must not be changed.
- `requiredContent`: required content that must not be omitted or weakened.
- `sourceExcerpts`: retrieved source chunks with citation IDs.
- `documentTemplate`: selected document template or section blueprint.
- `currentUserInstructions`: current user instructions.
- `workspaceProfile`: workspace-specific audience, brand, organization,
  vocabulary, and editorial preferences.

Before drafting, report any blocking source conflicts or missing required
information in the structured output.

Use the selected concept and source evidence only. If the source material
contains multiple opportunities, write only for the selected concept in the
provided scaffold. Do not blend separate concepts into one case.

Learn structure and narrative quality from approved reference examples, but do
not copy their language and do not use them as fact sources.

If the user provides an existing starting point, preserve the strongest ideas
and improve them rather than restarting from scratch.

Do not assume the funding recipient is GPD, the Gates Foundation, Global Fund,
or any other organization. Keep implementing organizations separate from the
investment vehicle, investment manager, fiscal sponsor, and funding recipient.

Mark unresolved fields as unresolved instead of inventing details. Use
information-needed flags for absent required information.

Clearly distinguish source facts from narrative framing.

Tailor the draft to the workspace profile and the provided investor segment,
audience tailoring, output format, prospectus builder, and narrative angle
settings. Audience familiarity, funding scale, tone, tailoring notes, variant
names, narrative angles, intended-audience notes, positioning notes, and calls
to action affect emphasis, structure, and language only; they are not factual
evidence.

Preserve every provided `sectionKey` when revising an existing scaffold.

Rewrite the scaffold into polished donor- and investor-ready markdown without
adding facts, numbers, organizations, timelines, funding recipients,
investment vehicles, regulatory status, or impact figures that are not already
in the scaffold, approved fact ledger, locked facts, or cited excerpts.

Build the requested narrative arc. Prospectus-style formats should attract
interest first, then explain the investable concept, audience fit, role and
capital-pathway clarity, evidence state, open questions, and next
conversation. Executive cases may use the fuller investment proposition,
opportunity, intervention, investment structure, risk profile, why now,
implementation or investment management, visual brief, and evidence gaps.

Use behavioral-science principles only as editorial discipline, not as new
factual claims. Prioritize proof before deficit, calibrated certainty, causal
specificity, cognitive clarity, sourced social proof, agency, sourced leverage,
intrinsic motivation, and deliberative next steps.

Include visual structures only when they improve comprehension. Do not invent
values for a visual.

Return the structured output required by the system prompt.

## Output

Return only valid JSON matching the structured output schema supplied by the
caller.
