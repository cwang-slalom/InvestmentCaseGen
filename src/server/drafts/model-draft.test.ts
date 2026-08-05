import { describe, expect, it } from "vitest";

import type { Citation, ValidatedDraft } from "@/domain";

import { applyModelAuthoredDraft } from "./model-draft";

const citation: Citation = {
  id: "citation-1",
  sourceDocumentId: "document-1",
  filename: "source.txt",
  chunkId: "chunk-1",
  excerpt: "The program can expand community health worker delivery.",
};

function scaffoldDraft(): ValidatedDraft {
  return {
    id: "draft-1",
    opportunityId: "opportunity-1",
    outputType: "executive_investment_case",
    investorSegment: "general_donor",
    audienceTailoring: {
      familiarity: "new_to_topic",
      scale: "exploratory",
      tone: "balanced",
    },
    prospectusBuilder: {
      narrativeAngle: "catalytic_philanthropy",
    },
    title: "Community health worker scale-up",
    sectionOrder: [
      "investment_proposition",
      "why_now",
      "investment_vehicle_or_funding_recipient",
    ],
    sections: [
      {
        id: "section-1",
        sectionKey: "investment_proposition",
        title: "Investment Proposition",
        renderedMarkdown:
          "The program can expand community health worker delivery. [S1]",
        claimIds: ["claim-1"],
        evidenceGapIds: [],
        warningText: [],
        orderIndex: 0,
        regenerationCount: 0,
      },
      {
        id: "section-2",
        sectionKey: "why_now",
        title: "Why Now",
        renderedMarkdown: "The current access gap creates risk. [S1]",
        claimIds: ["claim-2"],
        evidenceGapIds: [],
        warningText: [],
        orderIndex: 1,
        regenerationCount: 0,
      },
      {
        id: "section-3",
        sectionKey: "investment_vehicle_or_funding_recipient",
        title: "Investment Vehicle or Funding Recipient",
        renderedMarkdown:
          "**Funding recipient:** Not established in the provided source materials.",
        claimIds: ["claim-3"],
        evidenceGapIds: ["gap-1"],
        warningText: ["Funding recipient is unresolved."],
        orderIndex: 2,
        regenerationCount: 0,
      },
    ],
    claims: [
      {
        id: "claim-1",
        statement: "The program can expand community health worker delivery.",
        kind: "factual",
        status: "source_provided",
        validationStatus: "supported",
        citationIds: ["citation-1"],
        derivedFromClaimIds: [],
      },
      {
        id: "claim-2",
        statement: "The current access gap creates risk.",
        kind: "factual",
        status: "source_provided",
        validationStatus: "supported",
        citationIds: ["citation-1"],
        derivedFromClaimIds: [],
      },
      {
        id: "claim-3",
        statement:
          "Funding recipient is not established in the provided source materials.",
        kind: "factual",
        status: "unresolved",
        validationStatus: "not_checked",
        citationIds: [],
        derivedFromClaimIds: [],
      },
    ],
    citations: [citation],
    evidenceGaps: [
      {
        id: "gap-1",
        fieldKey: "funding_pathway",
        description: "Funding recipient is unresolved.",
        severity: "medium",
      },
    ],
    narrativeChanges: [],
    followUpUpdates: [],
    generatedAtIso: "2026-07-16T00:00:00.000Z",
    draftNotice: "Draft for human review",
  };
}

describe("applyModelAuthoredDraft", () => {
  it("uses Gemini-authored section text while preserving validation guardrails", () => {
    const draft = applyModelAuthoredDraft({
      scaffold: scaffoldDraft(),
      citations: [citation],
      modelDraft: {
        title: "Gemini-authored community health worker case",
        narrativeChanges: ["Rewrote sections with donor-facing language."],
        sections: [
          {
            sectionKey: "investment_proposition",
            renderedMarkdown:
              "A donor can back a focused community health worker expansion using the cited delivery thesis. [S1]",
          },
          {
            sectionKey: "why_now",
            renderedMarkdown:
              "This should create 100 new delivery sites without support.",
          },
          {
            sectionKey: "investment_vehicle_or_funding_recipient",
            renderedMarkdown:
              "**Funding recipient:** Example Nonprofit is the funding recipient.",
          },
        ],
      },
    });

    expect(draft.title).toBe("Gemini-authored community health worker case");
    expect(
      draft.sections.find(
        (section) => section.sectionKey === "investment_proposition",
      )?.renderedMarkdown,
    ).toContain("donor can back");
    expect(
      draft.sections.find((section) => section.sectionKey === "why_now")
        ?.renderedMarkdown,
    ).not.toContain("100 new delivery sites");
    expect(
      draft.sections.find(
        (section) =>
          section.sectionKey === "investment_vehicle_or_funding_recipient",
      )?.renderedMarkdown,
    ).toContain("Not established in the provided source materials.");
    expect(draft.narrativeChanges).toContain(
      "Gemini authored draft section language.",
    );
    expect(draft.validation?.status).toBe("passed");
  });
});
