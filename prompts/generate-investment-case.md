# Generate Investment Case Prompt

Transform the selected source-grounded opportunity into the requested
donor-facing saved format. For `executive_investment_case`, use
`resources/templates/executive-investment-case.md`; for prospectus-style
formats, follow the provided `outputFormat.sectionBlueprint` and
`outputFormat.promptGuidance`.

The goal is to pull foundation materials into an investor- and donor-ready
case with stronger narrative, language, behavioral-science framing, and visual
storytelling direction while preserving source fidelity.

## Instructions

- Use the selected concept and source evidence.
- If the source material contains multiple opportunities, write only for the
  selected concept in the provided scaffold. Do not blend separate concepts
  into one case.
- Learn structure and narrative quality from reference examples, but do not copy their language.
- If the user provides an existing starting point, including Jenn's draft or
  notes, preserve the strongest ideas and improve them rather than restarting
  from scratch.
- Do not use reference examples as fact sources.
- Do not assume the funding recipient is GPD, the Gates Foundation, Global Fund, or any other organization.
- Keep implementing organization(s) separate from investment vehicle or funding recipient.
- Mark unresolved fields as unresolved instead of inventing details.
- Clearly distinguish source facts from narrative framing.
- Tailor the draft to the provided `investorSegment`, `audienceTailoring`,
  `outputFormat`, `prospectusBuilder`, and `narrativeAngle` settings.
  Audience familiarity, funding scale, tone, tailoring notes, variant names,
  narrative angles, intended-audience notes, positioning notes, and calls to
  action affect emphasis, structure, and language only; they are not factual
  evidence.
- Preserve every provided `sectionKey`. Return replacement markdown only for
  those existing section keys.
- Rewrite the scaffold into polished donor-ready markdown without adding facts,
  numbers, organizations, timelines, funding recipients, investment vehicles,
  regulatory status, or impact figures that are not already in the scaffold or
  cited excerpts.
- Build the requested narrative arc. Prospectus-style formats should attract
  interest first, then explain the investable concept, audience fit, role and
  capital-pathway clarity, evidence state, open questions, and next
  conversation. Executive cases may use the fuller investment proposition, why
  this matters, opportunity/intervention, investment structure or ask, risk
  profile, why now, implementation or investment management, visual brief, and
  evidence gaps.
- Use donor-friendly language: concrete, specific, emotionally resonant,
  concise, and oriented toward a clear next decision.
- Match the requested tone without overstating certainty. For big-bet or major
  donor audiences, emphasize scale conditions, governance, execution risks, and
  evidence needs only when those ideas are already present in the scaffold.
- Apply behavioral-science principles only as framing, not as new factual
  claims. Prioritize salience, specificity, credible urgency, audience fit, and
  a clear call to action.
- Include a visual brief for human review, such as suggested charts, maps,
  proof-point callouts, beneficiary journey moments, or implementation diagrams,
  and list the source evidence each visual would require.
- Include evidence gaps.

## Output

A complete Markdown draft suitable for human review, plus a visual brief and
evidence gaps.
