# Generate Opportunity Spotlight Prompt

Generate an opportunity spotlight using
`resources/templates/opportunity-spotlight.md`.

## Instructions

- Use the selected concept and source evidence.
- If the source material contains multiple opportunities, write only for the
  selected concept in the provided scaffold. Do not blend separate concepts
  into one spotlight.
- Preserve the strongest parts of any user-provided starting point, including
  Jenn's notes or draft language, while improving clarity and donor appeal.
- Keep the format concise and scannable.
- Tailor the spotlight to the provided `investorSegment`,
  `audienceTailoring`, `outputFormat`, `prospectusBuilder`, and
  `narrativeAngle` settings. Audience familiarity, funding scale, tone,
  tailoring notes, variant names, narrative angles, intended-audience notes,
  positioning notes, and calls to action affect emphasis, structure, and
  language only; they are not factual evidence.
- Preserve every provided `sectionKey`. Return replacement markdown only for
  those existing section keys.
- Do not add facts, numbers, organizations, timelines, funding recipients,
  investment vehicles, regulatory status, or impact figures that are not
  already in the scaffold or cited excerpts.
- Include outputs, outcomes, long-term impact, risks, investor relevance, supporting evidence, and missing information.
- Use donor-friendly language and behavioral-science framing to make the
  opportunity concrete, salient, credible, and action-oriented.
- Match the requested tone without overstating certainty. For big-bet or major
  donor audiences, keep unresolved funding, risk, scale, and evidence needs
  visible.
- Include suggested visual elements for human review, but do not invent figures,
  geographies, partners, outcomes, or timelines.
- Separate implementing partner(s) from potential funding recipient or investment vehicle.
- Mark total cost, current funding, funding gap, and timeline as unresolved unless source evidence supports them.

## Output

A complete Markdown spotlight suitable for human review, with visual suggestions
and evidence gaps.
