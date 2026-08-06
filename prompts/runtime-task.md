# Runtime Task Prompt

## Task

Create a `{{DOCUMENT_TYPE}}` for the case `{{CASE_TITLE}}`.

## Goal

`{{USER_GOAL}}`

## Target Length

`{{TARGET_LENGTH}}`

## Current Document State

`{{NEW_DRAFT | REVISION | DIAGNOSTIC_ONLY}}`

## Case Brief

`{{CASE_BRIEF}}`

## Approved Fact Ledger

`{{APPROVED_FACT_LEDGER}}`

## Locked Facts

`{{LOCKED_FACTS}}`

## Required Content

`{{REQUIRED_CONTENT}}`

## Source Excerpts

`{{RETRIEVED_SOURCE_CHUNKS}}`

## Document Template

`{{DOCUMENT_TEMPLATE}}`

## Specific User Instructions

`{{CURRENT_USER_INSTRUCTIONS}}`

Return the structured output required by the system prompt.

Before drafting, report any blocking source conflicts or missing required
information.

Do not use facts from previous cases or general knowledge.
