import { describe, expect, it } from "vitest";

import { MockModelProvider } from "@/server/model-provider";

import { extractOpportunitiesWithModel } from "./model-backed";

describe("extractOpportunitiesWithModel", () => {
  it("validates mock model output with the opportunity schema", async () => {
    const provider = new MockModelProvider(() => ({
      opportunities: [
        {
          id: "opportunity-1",
          title: {
            value: "Mock opportunity",
            status: "source_provided",
            confidence: "medium",
            citationIds: ["citation-1"],
          },
          summary: {
            value: "Mock summary.",
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
          fundingPathways: [
            {
              id: "pathway-1",
              pathwayType: "unresolved_pathway",
              status: "unresolved",
              confidence: "low",
              citationIds: [],
            },
          ],
          beneficiaryPopulations: [],
          claims: [],
          risks: [],
          evidenceGaps: [],
          overallStatus: "source_provided",
        },
      ],
    }));

    const opportunities = await extractOpportunitiesWithModel({
      projectId: "project-1",
      chunks: [],
      provider,
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.title.value).toBe("Mock opportunity");
  });
});
