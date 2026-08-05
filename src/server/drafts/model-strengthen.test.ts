import { describe, expect, it } from "vitest";

import type { Citation, OpportunityRecord } from "@/domain";

import { applyModelNarrativeStrengthening } from "./model-strengthen";
import { renderDraft } from "./render";

const citation: Citation = {
  id: "citation-1",
  sourceDocumentId: "document-1",
  filename: "source.txt",
  chunkId: "chunk-1",
  excerpt: "Funding can scale an implementation program for children.",
};

function opportunityRecord(): OpportunityRecord {
  return {
    id: "opportunity-record-1",
    projectId: "project-1",
    title: "Community health worker scale-up",
    overallStatus: "source_provided",
    sourceDocumentIds: ["document-1"],
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    opportunity: {
      id: "opportunity-1",
      title: {
        value: "Community health worker scale-up",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
      summary: {
        value: "Funding can scale an implementation program for children.",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
      problemStatement: {
        value: "Families face an access gap.",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
      proposedIntervention: {
        value: "Expand community health worker delivery.",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
      whyNow: {
        value: "The current gap creates risk for families.",
        status: "source_provided",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
      investorRelevance: {
        value: "Early capital could support scale-up planning.",
        status: "derived_from_sources",
        confidence: "medium",
        citationIds: ["citation-1"],
      },
      expectedOutcomes: [
        {
          value: "Improve access to care.",
          status: "source_provided",
          confidence: "medium",
          citationIds: ["citation-1"],
        },
      ],
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
      claims: [
        {
          id: "claim-1",
          statement:
            "Funding can scale an implementation program for children.",
          kind: "factual",
          status: "source_provided",
          validationStatus: "supported",
          citationIds: ["citation-1"],
          derivedFromClaimIds: [],
        },
      ],
      risks: [],
      evidenceGaps: [
        {
          id: "gap-1",
          fieldKey: "funding_pathway",
          description: "Funding recipient is unresolved.",
          severity: "medium",
        },
      ],
      overallStatus: "source_provided",
    },
  };
}

describe("applyModelNarrativeStrengthening", () => {
  it("adds safe generated framing while preserving validation", () => {
    const draft = renderDraft(opportunityRecord(), [citation], {
      outputType: "executive_investment_case",
      investorSegment: "general_donor",
    });
    const strengthened = applyModelNarrativeStrengthening(draft, {
      narrativeChanges: ["Sharper donor-facing proposition."],
      sectionAdditions: [
        {
          sectionKey: "investment_proposition",
          framingParagraph:
            "This case gives donors a concrete way to support a focused implementation thesis while keeping unresolved capital-pathway details visible.",
        },
        {
          sectionKey: "investment_ask",
          framingParagraph:
            "This ignored paragraph should not be inserted into a factual ask section.",
        },
        {
          sectionKey: "why_this_is_investable",
          framingParagraph:
            "This sentence mentions 50 percent and should be skipped.",
        },
      ],
      behavioralImprovements: [
        "Make the next diligence step explicit without adding new facts.",
      ],
      visualSuggestions: [
        "Use cited proof-point callouts rather than unsourced charts.",
      ],
      factsNeedingEvidence: ["Confirm the funding recipient before outreach."],
    });

    expect(
      strengthened.sections.find(
        (section) => section.sectionKey === "investment_proposition",
      )?.renderedMarkdown,
    ).toContain("focused implementation thesis");
    expect(
      strengthened.sections.find(
        (section) => section.sectionKey === "investment_ask",
      )?.renderedMarkdown,
    ).not.toContain("ignored paragraph");
    expect(
      strengthened.sections.find(
        (section) => section.sectionKey === "why_this_is_investable",
      )?.renderedMarkdown,
    ).not.toContain("50 percent");
    expect(strengthened.validation?.status).toBe("passed");
    expect(
      strengthened.claims.some(
        (claim) =>
          claim.kind === "narrative_framing" &&
          claim.statement.includes("focused implementation thesis"),
      ),
    ).toBe(true);
    expect(strengthened.narrativeChanges).toContain(
      "Sharper donor-facing proposition.",
    );
  });
});
