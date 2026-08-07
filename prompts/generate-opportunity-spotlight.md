# Generate Opportunity Spotlight Prompt

Use this prompt as the runtime task instruction for opportunity spotlight
generation. Generate a concise opportunity spotlight using only the selected
concept, approved facts, locked facts, and cited source excerpts.

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

If the source material contains multiple opportunities, write only for the
selected concept in the provided scaffold. Do not blend separate concepts into
one spotlight.

Preserve the strongest parts of any user-provided starting point while
improving clarity and donor relevance.

Keep the format concise and scannable.

Tailor the spotlight to the workspace profile and provided audience settings.
Audience familiarity, funding scale, tone, tailoring notes, variant names,
narrative angles, intended-audience notes, positioning notes, and calls to
action affect emphasis, structure, and language only; they are not factual
evidence.

Preserve every provided `sectionKey` when revising an existing scaffold.

Do not add facts, numbers, organizations, timelines, funding recipients,
investment vehicles, regulatory status, or impact figures that are not already
in the scaffold, approved fact ledger, locked facts, or cited excerpts.

Include outputs, outcomes, long-term impact, risks, investor relevance,
supporting evidence, required team or diligence content, and missing
information when those fields are supported or required.

For one-page opportunity summaries, organize content for a visual spotlight
layout rather than a long prose memo. Prefer concise sections that can map
into:

- opportunity thesis
- impact potential: activities, outputs, outcomes, impact
- execution snapshot: timeframe, cost, funding gap, or investment tiers when
  source-supported
- partner, team, and diligence spotlight
- risks, unresolved roles, and evidence boundary
- engage or next-conversation option

Choose each section `type` deliberately. Use `opportunity` for the core
concept, `metric` for sourced proof or figures, `team` for implementer or
delivery capability, `diligence` for unresolved questions, `risk` for risks,
and `engage` for next steps. Keep each section compact enough for a polished
one-page or short executive-summary renderer.

Use behavioral-science framing as an editorial discipline only. Make the
opportunity concrete, salient, credible, and action-oriented without
overstating certainty.

For big-bet or major donor audiences, keep unresolved funding, risk, scale,
and evidence needs visible.

Include suggested visual elements for human review only when they improve
comprehension. Do not invent figures, geographies, partners, outcomes, or
timelines.

Separate implementing partners from potential funding recipients, investment
vehicles, investment managers, fiscal sponsors, beneficiaries, and investor or
donor audiences.

Mark total cost, current funding, funding gap, and timeline as unresolved
unless source evidence supports them.

Return the structured output required by the system prompt.

## Output

Return only valid JSON matching the structured output schema supplied by the
caller.
