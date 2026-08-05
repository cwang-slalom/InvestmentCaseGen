
# AGENTS.md

## Product purpose

This repository contains an MVP for an Investment Case Generator.

The application helps users identify investable concepts in strategy
documents and turn them into persuasive, source-grounded materials for
potential investors, donors, and funding partners.

## Critical business distinction

The product is concept-first, not organization-first.

Do not assume that GPD, the Gates Foundation, or the user of the application
is the intended recipient of funding.

Funding may be directed to a separate implementing organization, nonprofit,
pooled fund, government program, research institution, product developer,
multilateral organization, or another investment vehicle.

Always distinguish between:

- concept owner
- sponsoring team
- implementing organization
- investment manager
- funding recipient
- delivery partner
- beneficiary
- investor or donor audience

If the source material does not identify the funding recipient or investment
vehicle, label it as unresolved. Never infer it without evidence.

## Product behavior

- Inspect source documents before generating content.
- Identify candidate investable concepts.
- Explain why each concept may be attractive to investors.
- Generate donor- and investor-ready narratives.
- Preserve factual accuracy and citations.
- Never fabricate impact figures, cost estimates, funding gaps, partners,
  regulatory status, or timelines.
- Clearly separate source facts from generated narrative framing.
- Treat generated content as a draft requiring human review.

## Development principles

- Read existing files before changing code.
- Maintain docs/PLAN.md and docs/DECISIONS.md.
- Prefer small, testable changes.
- Keep prompts in the prompts/ directory.
- Validate model responses with typed schemas.
- Keep model-provider and storage logic behind interfaces.
- Do not expose secrets.
- Do not add unnecessary frameworks or infrastructure.
- Run type checking, linting, and tests before declaring work complete.
