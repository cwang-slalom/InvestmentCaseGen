import { describe, expect, it } from "vitest";

import {
  FundingPathwaySchema,
  IntegrityReviewerOutputSchema,
  InvestmentCaseWriterOutputSchema,
  MemoryRecordSchema,
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

  it("validates the investment-case writer output contract", () => {
    const output = InvestmentCaseWriterOutputSchema.parse({
      status: "needs_information",
      source_summary: ["Source inventory inspected."],
      conflicts: [],
      information_needed: [
        "⚑ INFO NEEDED — Funding recipient belongs in the investment structure because the capital pathway depends on it.",
      ],
      required_content_check: {
        investment_team_present: false,
        technical_team_present: true,
        diligence_present: false,
      },
      outline: ["What is now possible"],
      draft_blocks: [
        {
          id: "block-1",
          type: "narrative",
          heading: "What is now possible",
          body: "Draft text [S1].",
          citations: ["S1"],
        },
      ],
      quality_review: {
        changed_facts: [],
        unsupported_claims: [],
        missing_citations: [],
        tone_issues: [],
        direct_appeals: [],
        repetition: [],
      },
    });

    expect(output.draft_blocks[0].locked).toBe(false);
  });

  it("validates the independent integrity reviewer output contract", () => {
    expect(
      IntegrityReviewerOutputSchema.parse({
        decision: "revise",
        findings: [
          {
            severity: "BLOCKING",
            type: "changed_number",
            block_id: "block-1",
            description: "The draft changed USD 5M to USD 50M.",
            source_reference: "locked_fact_1",
            recommended_action: "Restore the locked amount.",
          },
        ],
      }).findings[0].severity,
    ).toBe("BLOCKING");
  });

  it("validates scoped memory records with approval metadata", () => {
    const memory = MemoryRecordSchema.parse({
      id: "memory_123",
      scope: "workspace",
      category: "editorial_preference",
      value: {
        lead_with: ["proof", "progress"],
      },
      source: "administrator",
      source_reference: "workspace-profile.example.yaml",
      status: "approved",
      approved_by: "admin-user",
      created_at: "2026-08-05T00:00:00Z",
      updated_at: "2026-08-05T00:00:00Z",
      expires_at: null,
    });

    expect(memory.scope).toBe("workspace");
    expect(memory.status).toBe("approved");
  });
});
