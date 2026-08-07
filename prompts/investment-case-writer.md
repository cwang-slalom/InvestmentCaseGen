# Investment Case Writer Prompt

Use the core system prompt, workspace profile, case brief, approved fact
ledger, locked facts, required content list, source excerpts, selected
document template, and current user instructions.

## Task

Create a `{{DOCUMENT_TYPE}}` for the case `{{CASE_TITLE}}`.

## Goal

`{{USER_GOAL}}`

## Target Length

`{{TARGET_LENGTH}}`

## Current Document State

`{{NEW_DRAFT | REVISION | DIAGNOSTIC_ONLY}}`

## Inputs

- Case brief: `{{CASE_BRIEF}}`
- Approved fact ledger: `{{APPROVED_FACT_LEDGER}}`
- Locked facts: `{{LOCKED_FACTS}}`
- Required content: `{{REQUIRED_CONTENT}}`
- Source excerpts: `{{RETRIEVED_SOURCE_CHUNKS}}`
- Document template: `{{DOCUMENT_TEMPLATE}}`
- Specific user instructions: `{{CURRENT_USER_INSTRUCTIONS}}`

## Workflow

Before drafting, report any blocking source conflicts or missing required
information in the structured output.

Do not use facts from previous cases or general knowledge.

Create a briefing-style investment case draft using only approved case facts
and citations.

The output should contain structured draft blocks for narrative, metric
callouts, opportunity summary, team and role distinctions, diligence, risk,
investment structure, and engagement or next steps when supported by the case
brief and required content.

Shape the blocks for a polished investor briefing format, not a plain prose
memo. When evidence supports it, create distinct blocks that a renderer can
place into an opportunity thesis, impact pathway, metric callout, timeline or
investment tier, team and diligence panel, risk table, and engage options.

Use section headings that sound like editorial judgment rather than generic
labels. Keep every block concise enough for a high-end executive summary
unless the requested format explicitly calls for a longer case.

Use donor- and investor-ready language, but do not create new facts or make a
direct funding ask.

Return the structured output required by the core system prompt.
