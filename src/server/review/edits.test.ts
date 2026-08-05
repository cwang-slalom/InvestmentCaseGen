import { describe, expect, it } from "vitest";

import type { OpportunityRecord } from "@/domain";

import { applyOpportunityReviewEdits } from "./edits";

describe("applyOpportunityReviewEdits", () => {
  it("preserves citation metadata and marks edited fields as human-reviewed", () => {
    const record = {
      id: "record-1",
      projectId: "project-1",
      title: "Old title",
      overallStatus: "source_provided",
      sourceDocumentIds: ["document-1"],
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
      opportunity: {
        id: "opportunity-1",
        title: {
          value: "Old title",
          status: "source_provided",
          confidence: "medium",
          citationIds: ["citation-1"],
        },
        summary: {
          value: "Old summary",
          status: "source_provided",
          confidence: "medium",
          citationIds: ["citation-1"],
        },
        problemStatement: {
          status: "unresolved",
          confidence: "low",
          citationIds: [],
        },
        proposedIntervention: {
          status: "unresolved",
          confidence: "low",
          citationIds: [],
        },
        whyNow: { status: "unresolved", confidence: "low", citationIds: [] },
        investorRelevance: {
          status: "unresolved",
          confidence: "low",
          citationIds: [],
        },
        expectedOutcomes: [],
        longTermImpact: [],
        geographies: [],
        organizationRoles: [],
        fundingPathways: [],
        beneficiaryPopulations: [],
        claims: [],
        risks: [],
        evidenceGaps: [],
        overallStatus: "source_provided",
      },
    } as OpportunityRecord;

    const result = applyOpportunityReviewEdits(record, {
      title: "Reviewed title",
      titleStatus: "generated_framing",
    });

    expect(result.opportunity.title.value).toBe("Reviewed title");
    expect(result.opportunity.title.status).toBe("generated_framing");
    expect(result.opportunity.title.citationIds).toEqual(["citation-1"]);
    expect(result.opportunity.title.humanReviewed).toBe(true);
    expect(result.reviewMetadata.humanReviewedFields).toContain("title");
  });
});
