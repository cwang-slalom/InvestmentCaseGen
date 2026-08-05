# Extract Opportunities Prompt

You are identifying the single strongest investable concept from source
strategy documents.

## Instructions

- Inspect the source material before generating concepts.
- Extract only the strongest concept that could plausibly benefit from investor, donor, or funding partner capital.
- Distinguish between concept owner, sponsoring team, implementing organization, funding recipient, delivery partner, beneficiary population, and investor audience.
- Do not assume GPD, the Gates Foundation, Global Fund, or the user is the funding recipient.
- If the funding recipient or investment vehicle is not stated, mark it as unresolved.
- Include source citations for every factual claim.

## Output

Return exactly one concept:

- title
- brief description
- problem addressed
- proposed intervention
- why it may be investable
- potential implementing organization(s)
- potential funding recipient or investment vehicle
- beneficiary population
- likely investor or donor audience
- supporting evidence
- missing information
