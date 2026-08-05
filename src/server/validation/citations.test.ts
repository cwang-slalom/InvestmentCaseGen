import { describe, expect, it } from "vitest";

import type { Opportunity } from "@/domain";

import { validateOpportunityCitations } from "./citations";

function baseOpportunity(): Opportunity {
  return {
    id: "opportunity-1",
    title: {
      value: "Program",
      status: "source_provided",
      confidence: "medium",
      citationIds: ["citation-1"],
    },
    summary: {
      value: "Program reaches 10,000 children.",
      status: "source_provided",
      confidence: "medium",
      citationIds: [],
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
    organizationRoles: [
      {
        id: "role-1",
        organizationName: "Org A",
        roleType: "implementing_organization",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
      {
        id: "role-2",
        organizationName: "Org B",
        roleType: "implementing_organization",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-2"],
      },
    ],
    fundingPathways: [],
    beneficiaryPopulations: [],
    claims: [],
    risks: [],
    evidenceGaps: [],
    overallStatus: "source_provided",
  };
}

describe("validateOpportunityCitations", () => {
  it("detects unsupported numbers and conflicting organization evidence", () => {
    const result = validateOpportunityCitations(baseOpportunity());

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "unsupported_number" }),
        expect.objectContaining({ type: "conflicting_evidence" }),
      ]),
    );
    expect(result.status).toBe("failed");
  });
});
