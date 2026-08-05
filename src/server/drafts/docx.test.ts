import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { ValidatedDraft } from "@/domain";

import { draftToDocxBuffer } from "./docx";

describe("draftToDocxBuffer", () => {
  it("exports a readable DOCX package with draft content", () => {
    const draft: ValidatedDraft = {
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
      title: "Test Investment Case",
      sectionOrder: ["investment_proposition"],
      sections: [
        {
          id: "section-1",
          sectionKey: "investment_proposition",
          title: "Investment Proposition",
          renderedMarkdown: "A concise donor-facing proposition.",
          claimIds: ["claim-1"],
          evidenceGapIds: [],
          warningText: [],
          orderIndex: 0,
          regenerationCount: 0,
        },
      ],
      claims: [
        {
          id: "claim-1",
          statement: "A concise donor-facing proposition.",
          kind: "narrative_framing",
          status: "generated_framing",
          validationStatus: "not_checked",
          citationIds: [],
          derivedFromClaimIds: [],
        },
      ],
      citations: [],
      evidenceGaps: [],
      narrativeChanges: [],
      followUpUpdates: [],
      generatedAtIso: "2026-07-15T00:00:00.000Z",
      draftNotice: "Draft for human review",
    };

    const buffer = draftToDocxBuffer(draft);
    const files = unzipSync(buffer);
    const documentXml = strFromU8(files["word/document.xml"]!);

    expect(buffer[0]).toBe(0x50);
    expect(documentXml).toContain("Test Investment Case");
    expect(documentXml).toContain("A concise donor-facing proposition.");
  });
});
