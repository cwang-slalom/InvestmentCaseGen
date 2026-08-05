import { describe, expect, it } from "vitest";

import {
  FundingPathwaySchema,
  MoneyRangeSchema,
  OrganizationRoleSchema,
  OutputTypeSchema,
  ValidatedDraftSchema,
} from "./schemas";

describe("domain schemas", () => {
  it("rejects inverted money ranges", () => {
    expect(() =>
      MoneyRangeSchema.parse({
        minimum: 20,
        maximum: 10,
      }),
    ).toThrow(/maximum/);
  });

  it("keeps funding pathway evidence separate from organization roles", () => {
    expect(() =>
      OrganizationRoleSchema.parse({
        id: "role-1",
        organizationName: "Example Implementer",
        roleType: "funding_recipient",
        status: "source_provided",
        confidence: "high",
        citationIds: ["citation-1"],
      }),
    ).toThrow();

    expect(
      FundingPathwaySchema.parse({
        id: "pathway-1",
        pathwayType: "unresolved_pathway",
        status: "unresolved",
        confidence: "low",
      }).pathwayType,
    ).toBe("unresolved_pathway");
  });

  it("requires the human review draft notice", () => {
    expect(() =>
      ValidatedDraftSchema.parse({
        id: "draft-1",
        opportunityId: "opportunity-1",
        outputType: "opportunity_spotlight",
        title: "Draft",
        draftNotice: "Final",
      }),
    ).toThrow();
  });

  it("defaults donor follow-up updates for existing drafts", () => {
    const draft = ValidatedDraftSchema.parse({
      id: "draft-1",
      opportunityId: "opportunity-1",
      outputType: "opportunity_spotlight",
      title: "Draft",
      generatedAtIso: "2026-07-21T00:00:00.000Z",
      draftNotice: "Draft for human review",
    });

    expect(draft.followUpUpdates).toEqual([]);
  });

  it("defaults audience tailoring for existing drafts", () => {
    const draft = ValidatedDraftSchema.parse({
      id: "draft-1",
      opportunityId: "opportunity-1",
      outputType: "executive_investment_case",
      investorSegment: "general_donor",
      title: "Draft",
      generatedAtIso: "2026-07-21T00:00:00.000Z",
      draftNotice: "Draft for human review",
    });

    expect(draft.audienceTailoring).toEqual({
      familiarity: "new_to_topic",
      scale: "exploratory",
      tone: "balanced",
    });
  });

  it("supports prospectus formats and defaults prospectus builder metadata", () => {
    const draft = ValidatedDraftSchema.parse({
      id: "draft-1",
      opportunityId: "opportunity-1",
      outputType: "investment_prospectus",
      investorSegment: "us_foundation_program_officer",
      title: "Draft",
      generatedAtIso: "2026-07-21T00:00:00.000Z",
      draftNotice: "Draft for human review",
    });

    expect(OutputTypeSchema.parse("donor_one_pager")).toBe("donor_one_pager");
    expect(OutputTypeSchema.parse("donor_deck")).toBe("donor_deck");
    expect(OutputTypeSchema.parse("meeting_talking_points")).toBe(
      "meeting_talking_points",
    );
    expect(OutputTypeSchema.parse("source_appendix")).toBe("source_appendix");
    expect(draft.prospectusBuilder).toEqual({
      narrativeAngle: "catalytic_philanthropy",
    });
  });
});
