import { describe, expect, it } from "vitest";

import type { AudienceProfile, ExtractedField, Opportunity } from "../types";
import {
  editField,
  editExtractedField,
  simulateExistingOpportunitySmoke,
  simulateNewOpportunitySmoke,
  suggestionFromSelection,
} from "./workflow";

const opportunity: Opportunity = {
  id: "opp-demo",
  title: "Demo Opportunity",
  programArea: "Demo systems",
  geography: "Fictional region",
  summary: "Synthetic opportunity.",
  validationStatus: "Demo approved",
  lastUpdated: "2026-08-01",
  fundingRange: "USD 1-2 million",
  whyNow: "A synthetic window is open.",
  reach: "10,000 fictional residents",
  primaryOutcomes: ["Better readiness"],
  differentiators: ["Clear evidence boundary"],
  sourceList: [
    {
      id: "src-demo",
      title: "Synthetic source",
      sourceType: "brief",
      label: "Example source set",
      locator: "p. 1",
      excerpt: "Synthetic excerpt.",
      status: "Example source set",
    },
  ],
};

const audience: AudienceProfile = {
  id: "aud-demo",
  name: "Example Fund",
  audienceType: "Philanthropic foundation",
  relationshipStage: "Warm",
  interests: ["evidence"],
  geography: "Fictional region",
  familiarity: "Moderate",
  donorPersona: "Evidence-oriented funder",
  technicalFamiliarity: "Moderate",
  narrativeApproach: "Lead with proof.",
  profileUrl: "#mock",
};

const extracted: ExtractedField = {
  id: "funding_range",
  label: "Funding range",
  value: "USD 6-9 million",
  confidence: 0.81,
  sourceLabel: "Fixture",
  locator: "budget note",
  metadata: { source: "extracted_source", required: true, editable: true, confirmed: false },
  verified: false,
  locked: false,
};

describe("workflow state helpers", () => {
  it("creates editable AI suggestions with provenance", () => {
    const suggestions = suggestionFromSelection(opportunity, audience);
    expect(suggestions).toHaveLength(5);
    expect(suggestions.find((field) => field.id === "narrative_approach")?.metadata.source).toBe("ai_suggestion");
  });

  it("marks edited suggestions as user-confirmed", () => {
    const [edited] = editField(suggestionFromSelection(opportunity, audience), "relationship_stage", "Active");
    expect(edited.value).toBe("Active");
    expect(edited.metadata.source).toBe("user");
    expect(edited.metadata.confirmed).toBe(true);
  });

  it("supports extraction verification and locking", () => {
    const [locked] = editExtractedField([extracted], "funding_range", { verified: true, locked: true });
    expect(locked.verified).toBe(true);
    expect(locked.locked).toBe(true);
  });

  it("passes the existing-opportunity smoke path", () => {
    expect(simulateExistingOpportunitySmoke(opportunity, audience)).toEqual([
      "existing-step-1:pass",
      "existing-step-2:pass",
      "existing-step-3:pass",
      "existing-step-4:pass",
    ]);
  });

  it("passes the new-opportunity smoke path", () => {
    expect(simulateNewOpportunitySmoke([extracted])).toEqual([
      "new-step-1:pass",
      "new-step-2:pass",
      "new-step-3:pass",
    ]);
  });
});
