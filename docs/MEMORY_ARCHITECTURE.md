# Memory Architecture

This document records the target memory structure for investment-case
generation. Memory is not a single prompt blob. It should be retrieved by
scope, approval status, and case relevance.

## Memory Objects

### ProductPolicy

- universal factual-integrity rules
- generic editorial principles
- prompt version

### WorkspaceProfile

- audience
- brand
- organization vocabulary
- approved vehicles
- editorial preferences
- approved benchmark cases

### ProjectState

- current case status
- open questions
- requested changes
- reviewers
- deadlines

### CaseKnowledge

- source documents
- source chunks
- fact ledger
- locked facts
- citations
- approved corrections

### SessionInstruction

- current requested edit
- target length
- selected sections
- temporary preferences

## Memory Record

Every stored memory item should include at least:

```json
{
  "id": "memory_123",
  "scope": "product | workspace | case | session",
  "category": "editorial_preference",
  "value": {},
  "source": "user | source_document | administrator",
  "source_reference": "",
  "status": "proposed | approved | deprecated",
  "approved_by": "",
  "created_at": "",
  "updated_at": "",
  "expires_at": null
}
```

## Retrieval Rules

- Load `ProductPolicy` for every generation and review call.
- Load `WorkspaceProfile` for the active workspace only.
- Load `ProjectState` only for the active project.
- Load `CaseKnowledge` only for the active case.
- Load `SessionInstruction` only for the current requested edit or revision.
- Do not reuse case facts across cases.
- Require administrator approval before workspace memory affects generation.
- Keep source facts, approved corrections, and generated framing separate.

## Implementation Note

The Phase 1 FastAPI app still uses in-memory repositories for demo project
state. This target memory model should be migrated into persistent storage when
workspace and case memory move beyond the current proof of concept.
