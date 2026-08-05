import { describe, expect, it } from "vitest";

import type { Opportunity, SourceChunk } from "@/domain";

import {
  detectFundingPathways,
  detectOrganizationRoles,
  enrichOpportunityRolesAndPathways,
} from "./roles";

function chunk(text: string): SourceChunk {
  return {
    id: "chunk-1",
    sourceDocumentId: "document-1",
    chunkIndex: 0,
    text,
    charStart: 0,
    charEnd: text.length,
    citation: {
      id: "citation-1",
      sourceDocumentId: "document-1",
      filename: "source.txt",
      chunkId: "chunk-1",
      excerpt: text,
    },
    metadata: { wordCount: text.split(/\s+/).length },
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
  };
}

describe("role and funding pathway detection", () => {
  it("keeps sponsor and implementer distinct from funding recipient", () => {
    const chunks = [
      chunk(
        "Sponsored by Gates Foundation. Implemented by Example Nonprofit. The program needs funding.",
      ),
    ];

    expect(detectOrganizationRoles(chunks)).toMatchObject([
      {
        organizationName: "Gates Foundation",
        roleType: "sponsoring_team",
      },
      {
        organizationName: "Example Nonprofit",
        roleType: "implementing_organization",
      },
    ]);
    expect(detectFundingPathways(chunks)).toHaveLength(0);
  });

  it("detects explicit funding recipient and vehicle evidence", () => {
    const chunks = [
      chunk(
        "Funding recipient is Example Nonprofit. Investment vehicle is Child Health Pooled Fund. Nonprofit is Local Delivery Org.",
      ),
    ];

    expect(detectFundingPathways(chunks)).toMatchObject([
      {
        pathwayType: "funding_recipient",
        name: "Example Nonprofit",
      },
      {
        pathwayType: "investment_vehicle",
        name: "Child Health Pooled Fund",
      },
      {
        pathwayType: "nonprofit",
        name: "Local Delivery Org",
      },
    ]);
  });

  it("returns unresolved pathway when no explicit pathway is established", () => {
    const opportunity: Opportunity = {
      id: "opportunity-1",
      title: {
        value: "Program",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
      summary: {
        value: "A program needs funding.",
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
    };

    const enriched = enrichOpportunityRolesAndPathways(opportunity, [
      chunk(
        "Sponsored by Gates Foundation and implemented by Example Nonprofit.",
      ),
    ]);

    expect(enriched.fundingPathways).toMatchObject([
      {
        pathwayType: "unresolved_pathway",
        note: "Not established in the provided source materials.",
      },
    ]);
  });
});
