import { describe, expect, it } from "vitest";

import type { Citation, OpportunityRecord } from "@/domain";

import { regenerateDraftSection, renderDraft } from "./render";

function occurrenceCount(value: string, search: string) {
  return value.split(search).length - 1;
}

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
          pathwayType: "unresolved_pathway",
          status: "unresolved",
          confidence: "low",
          citationIds: [],
          note: "Not established in the provided source materials.",
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

describe("renderDraft", () => {
  it("renders an executive investment case with claim-level citation mapping", () => {
    const draft = renderDraft(opportunityRecord(), [citation], {
      outputType: "executive_investment_case",
      investorSegment: "philanthropic_foundation",
      audienceTailoring: {
        familiarity: "new_to_topic",
        scale: "big_bet",
        tone: "warm",
        customInstructions: "Lead with a clear first-meeting narrative.",
      },
    });

    expect(draft.outputType).toBe("executive_investment_case");
    expect(draft.sections.map((section) => section.sectionKey)).toContain(
      "investment_vehicle_or_funding_recipient",
    );
    expect(draft.sections.map((section) => section.sectionKey)).toContain(
      "donor_language_and_behavioral_framing",
    );
    expect(draft.sections.map((section) => section.sectionKey)).toContain(
      "visual_brief",
    );
    expect(
      draft.sections
        .find((section) => section.sectionKey === "visual_brief")
        ?.renderedMarkdown.includes("Funding visual"),
    ).toBe(true);
    expect(
      occurrenceCount(
        draft.sections.find(
          (section) => section.sectionKey === "investment_proposition",
        )?.renderedMarkdown ?? "",
        "For a philanthropic foundation, the case should emphasize additionality, learning value, and catalytic use of grant capital.",
      ),
    ).toBe(1);
    expect(draft.audienceTailoring).toMatchObject({
      familiarity: "new_to_topic",
      scale: "big_bet",
      tone: "warm",
    });
    expect(
      draft.sections
        .find((section) => section.sectionKey === "investment_proposition")
        ?.renderedMarkdown.includes("Audience tailoring"),
    ).toBe(true);
    expect(
      draft.sections
        .find((section) => section.sectionKey === "visual_brief")
        ?.renderedMarkdown.includes("large commitment"),
    ).toBe(true);
    expect(draft.sections.every((section) => section.claimIds.length > 0)).toBe(
      true,
    );
    expect(
      draft.claims.some((claim) => claim.citationIds.includes("citation-1")),
    ).toBe(true);
    expect(
      draft.sections
        .find(
          (section) =>
            section.sectionKey === "investment_vehicle_or_funding_recipient",
        )
        ?.renderedMarkdown.includes(
          "Not established in the provided source materials.",
        ),
    ).toBe(true);
    expect(draft.narrativeChanges).toContain(
      "Tailored framing for Philanthropic Foundation.",
    );
    expect(draft.narrativeChanges).toContain(
      "Audience tailoring applied: New to topic / Big bet / Warm.",
    );
    expect(draft.validation?.status).toBe("passed");
    expect(draft.productQualityEvaluation?.overallScore).toBeGreaterThan(3);
  });

  it("renders an opportunity spotlight and regenerates a single section", () => {
    const record = opportunityRecord();
    const draft = renderDraft(record, [citation], {
      outputType: "opportunity_spotlight",
      investorSegment: "impact_investor",
    });
    const regenerated = regenerateDraftSection(
      draft,
      record,
      [citation],
      "investor_relevance",
    );

    expect(draft.sections.map((section) => section.sectionKey)).toContain(
      "investor_relevance",
    );
    expect(draft.sections.map((section) => section.sectionKey)).toContain(
      "visual_brief",
    );
    expect(
      regenerated.sections.find(
        (section) => section.sectionKey === "investor_relevance",
      )?.regenerationCount,
    ).toBe(1);
    expect(regenerated.narrativeChanges).toEqual(
      expect.arrayContaining(["Regenerated section: investor_relevance."]),
    );
  });

  it("renders a saved investment prospectus variant with evidence separation", () => {
    const draft = renderDraft(opportunityRecord(), [citation], {
      outputType: "investment_prospectus",
      investorSegment: "us_foundation_program_officer",
      audienceTailoring: {
        familiarity: "new_to_topic",
        scale: "major_donor",
        tone: "direct",
      },
      prospectusBuilder: {
        variantLabel: "US foundation prospectus",
        narrativeAngle: "evidence_and_diligence",
        callToAction: "Invite a diligence call with the program officer.",
      },
    });

    expect(draft.variant).toMatchObject({
      label: "US foundation prospectus",
      formatLabel: "Investment Prospectus",
      audienceProfileLabel: "US Foundation Program Officer",
      narrativeAngle: "evidence_and_diligence",
    });
    expect(draft.sections.map((section) => section.sectionKey)).toEqual(
      expect.arrayContaining([
        "interest_thesis",
        "prospectus_snapshot",
        "evidence_and_open_questions",
        "next_conversation",
      ]),
    );
    const evidenceSection = draft.sections.find(
      (section) => section.sectionKey === "evidence_and_open_questions",
    );

    expect(evidenceSection?.renderedMarkdown).toContain("**Source facts:**");
    expect(evidenceSection?.renderedMarkdown).toContain(
      "**Generated framing:**",
    );
    expect(evidenceSection?.renderedMarkdown).toContain(
      "**Unresolved items:**",
    );
    expect(
      draft.claims.some((claim) => claim.status === "generated_framing"),
    ).toBe(true);
    expect(
      draft.sections
        .find((section) => section.sectionKey === "prospectus_snapshot")
        ?.renderedMarkdown.includes(
          "Not established in the provided source materials.",
        ),
    ).toBe(true);
  });
});
