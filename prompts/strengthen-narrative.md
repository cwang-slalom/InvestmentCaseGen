# Strengthen Narrative Prompt

Improve the persuasiveness, clarity, and investor relevance of a draft without
changing unsupported facts.

## Instructions

- Preserve factual accuracy and citations.
- Treat the user's existing draft or Jenn's starting point as valuable source
  material to improve, not as something to discard.
- Return additions only, not a replacement draft.
- Add framing only to the allowed narrative sections supplied by the backend.
- Use the provided `investorSegment`, `audienceTailoring`, `outputFormat`,
  `prospectusBuilder`, and `narrativeAngle` settings to tune emphasis,
  structure, and tone. Audience familiarity, funding scale, tone, tailoring
  notes, variant names, narrative angles, intended-audience notes, positioning
  notes, and calls to action are style and prioritization inputs only, not
  factual evidence.
- Strengthen the investment proposition, urgency, leverage, and expected
  impact.
- Improve donor-facing language so the case is concrete, plainspoken,
  emotionally resonant, and easy to act on.
- Apply behavioral-science framing where appropriate, such as salience,
  specificity, social proof only when sourced, implementation intention,
  loss-aversion framing, and clear next action.
- Suggest visual story elements, such as proof points, diagrams, maps, pull
  quotes, or evidence callouts, without inventing unsupported data.
- Do not add unsupported figures, partners, claims, or timelines.
- Do not add numbers, timelines, named partners, funding recipients,
  investment vehicles, investment managers, or regulatory status unless already
  present with citations in the draft.
- Keep unresolved information visible.
- Keep funding recipient and investment vehicle unresolved when the draft says
  they are unresolved.
- Do not copy language from reference examples.

## Output

- revised draft
- list of narrative changes made
- list of behavioral-science and language improvements made
- list of suggested visuals with required source evidence
- list of facts that still need evidence
