import { describe, expect, it } from "vitest";

import type { Opportunity } from "@/domain";

import { assessOpportunityInvestability } from "./investability";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opportunity-1",
    title: {
      value: "Scale-up program",
      status: "source_provided",
      confidence: "medium",
      citationIds: ["citation-1"],
    },
    summary: {
      value: "Funding can scale a program.",
      status: "source_provided",
      confidence: "medium",
      citationIds: ["citation-1"],
    },
    problemStatement: {
      value: "Access gap is significant.",
      status: "source_provided",
      confidence: "medium",
      citationIds: ["citation-1"],
    },
    proposedIntervention: {
      value: "Scale implementation.",
      status: "source_provided",
      confidence: "medium",
      citationIds: ["citation-1"],
    },
    whyNow: {
      value: "Funding gap is urgent.",
      status: "source_provided",
      confidence: "medium",
      citationIds: ["citation-1"],
    },
    investorRelevance: {
      value: "Early philanthropic capital can catalyze leverage.",
      status: "derived_from_sources",
      confidence: "medium",
      citationIds: ["citation-1"],
    },
    expectedOutcomes: [
      {
        value: "Improve access.",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
    ],
    longTermImpact: [],
    geographies: [],
    organizationRoles: [
      {
        id: "role-1",
        organizationName: "Example Nonprofit",
        roleType: "implementing_organization",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
    ],
    fundingPathways: [
      {
        id: "pathway-1",
        pathwayType: "funding_recipient",
        name: "Example Nonprofit",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
    ],
    beneficiaryPopulations: [],
    claims: [
      {
        id: "claim-1",
        statement: "Funding can scale a program.",
        kind: "factual",
        status: "source_provided",
        validationStatus: "supported",
        citationIds: ["citation-1"],
        derivedFromClaimIds: [],
      },
    ],
    risks: [],
    evidenceGaps: [],
    overallStatus: "source_provided",
    ...overrides,
  };
}

describe("assessOpportunityInvestability", () => {
  it("scores criteria and returns readiness flags", () => {
    const assessment = assessOpportunityInvestability(opportunity());

    expect(assessment.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ criterionKey: "problem_significance" }),
        expect.objectContaining({
          criterionKey: "clarity_of_funding_recipient_or_investment_vehicle",
          score: 5,
        }),
      ]),
    );
    expect(assessment.readyForInvestmentCaseDevelopment).toBe(true);
  });

  it("blocks investor outreach when funding pathway is unresolved", () => {
    const assessment = assessOpportunityInvestability(
      opportunity({
        fundingPathways: [
          {
            id: "pathway-1",
            pathwayType: "unresolved_pathway",
            status: "unresolved",
            confidence: "low",
            citationIds: [],
            note: "Not established in the provided source materials.",
          },
        ],
      }),
    );

    expect(assessment.readyForInvestorOutreach).toBe(false);
  });
});
