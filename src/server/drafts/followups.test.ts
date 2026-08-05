import { describe, expect, it } from "vitest";

import type { Citation, OpportunityRecord } from "@/domain";

import { applyDonorFollowUpToDraft } from "./followups";
import { renderDraft } from "./render";

const citation: Citation = {
  id: "citation-1",
  sourceDocumentId: "document-1",
  filename: "source.txt",
  chunkId: "chunk-1",
  excerpt:
    "Funding can scale an implementation program for children and improve access to care.",
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
        value:
          "Funding can scale an implementation program for children and improve access to care.",
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
            "Funding can scale an implementation program for children and improve access to care.",
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

function draft() {
  return renderDraft(opportunityRecord(), [citation], {
    outputType: "executive_investment_case",
    investorSegment: "general_donor",
  });
}

describe("applyDonorFollowUpToDraft", () => {
  it("records unsupported funding-pathway follow-ups as evidence needs", () => {
    const updated = applyDonorFollowUpToDraft({
      draft: draft(),
      donorName: "Example Foundation",
      message:
        "Can you confirm the funding recipient and investment vehicle before our review?",
      receivedAtIso: "2026-07-21T12:00:00.000Z",
    });
    const followUp = updated.followUpUpdates[0];

    expect(followUp.topics).toContain("funding_pathway");
    expect(followUp.actions).toContain("needs_source_evidence");
    expect(followUp.unresolvedRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "donor_followup.funding_pathway",
          severity: "high",
        }),
      ]),
    );
    expect(followUp.sourceClaimIds).toEqual([]);
    expect(followUp.proposedResponseMarkdown).toContain(
      "No directly matching source-backed claim",
    );
    expect(followUp.proposedResponseMarkdown).toContain("Example Foundation");
    expect(
      updated.sections.find(
        (section) => section.sectionKey === "donor_followup_updates",
      ),
    ).toBeDefined();
    expect(
      updated.sections
        .find(
          (section) =>
            section.sectionKey === "investment_vehicle_or_funding_recipient",
        )
        ?.warningText.some((warning) =>
          warning.includes("Donor follow-up asks about funding pathway"),
        ),
    ).toBe(true);
    expect(updated.validation?.status).toBe("passed");
  });

  it("uses existing cited claims when a follow-up asks for supported impact framing", () => {
    const updated = applyDonorFollowUpToDraft({
      draft: draft(),
      message: "Can we make the outcome and impact clearer for the donor?",
      receivedAtIso: "2026-07-21T12:00:00.000Z",
    });
    const followUp = updated.followUpUpdates[0];

    expect(followUp.topics).toContain("impact_metrics");
    expect(followUp.sourceClaimIds.length).toBeGreaterThan(0);
    expect(
      followUp.unresolvedRequests.some(
        (gap) => gap.fieldKey === "donor_followup.impact_metrics",
      ),
    ).toBe(false);
    expect(followUp.proposedResponseMarkdown).toContain("[S1]");
    expect(updated.narrativeChanges).toContain(
      "Applied donor follow-up update: impact metrics, audience fit.",
    );
  });
});
