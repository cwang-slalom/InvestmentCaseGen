import { describe, expect, it } from "vitest";

import type { ExtractedField, FieldValue, ReviewRole } from "../types";
import {
  canToggleOutput,
  validateExtraction,
  validateOpportunityAudience,
  validateReviewSetup,
  validateTask,
} from "./validation";

const approachField: FieldValue = {
  id: "tone",
  label: "Tone",
  value: "Balanced",
  provenanceLabel: "Suggested by Phase 1 setup",
  metadata: { source: "ai_suggestion", required: true, editable: true, confirmed: false },
};

const role: ReviewRole = {
  id: "technical",
  label: "Technical review",
  selected: true,
  status: "Planned",
  notes: "Generic role.",
};

const extractedField: ExtractedField = {
  id: "funding_range",
  label: "Funding range",
  value: "USD 6-9 million",
  confidence: 0.82,
  sourceLabel: "Synthetic source",
  locator: "budget note",
  metadata: { source: "extracted_source", required: true, editable: true, confirmed: false },
  verified: true,
  locked: true,
};

describe("workflow validation", () => {
  it("requires a task card or custom task", () => {
    expect(validateTask(null, "").valid).toBe(false);
    expect(validateTask("donor_meeting", "").valid).toBe(true);
    expect(validateTask(null, "Draft a briefing").valid).toBe(true);
  });

  it("requires opportunity, audience, meeting outcome, and output selection", () => {
    expect(
      validateOpportunityAudience({
        sourceMode: "existing",
        opportunityId: "",
        audienceId: "",
        intendedOutcome: "",
        selectedOutputs: [],
      }).messages,
    ).toEqual([
      "Select an opportunity.",
      "Select an audience or partner.",
      "Select the intended meeting outcome.",
      "Select at least one functional output.",
    ]);
  });

  it("prevents removing the last selected functional output", () => {
    expect(canToggleOutput(["investment_case"], "investment_case")).toBe(false);
    expect(canToggleOutput(["investment_case", "one_page"], "investment_case")).toBe(true);
  });

  it("requires extraction confirmation and verified fields", () => {
    expect(validateExtraction([{ ...extractedField, verified: false }], true).valid).toBe(false);
    expect(validateExtraction([extractedField], false).valid).toBe(false);
    expect(validateExtraction([extractedField], true).valid).toBe(true);
  });

  it("requires review setup confirmation", () => {
    expect(validateReviewSetup([approachField], [role], false, true).valid).toBe(false);
    expect(validateReviewSetup([approachField], [role], true, true).valid).toBe(true);
  });
});
