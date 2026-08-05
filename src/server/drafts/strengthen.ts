import { randomUUID } from "node:crypto";

import {
  ValidatedDraftSchema,
  getNarrativeAngleProfile,
  type AudienceTailoring,
  type InvestorSegment,
  type OpportunityClaim,
  type ProspectusBuilder,
  type ValidatedDraft,
} from "@/domain";

import {
  getAudienceTailoringProfile,
  getInvestorSegmentProfile,
  normalizeAudienceTailoring,
} from "./segments";

function framingClaim(statement: string): OpportunityClaim {
  return {
    id: randomUUID(),
    statement,
    kind: "narrative_framing",
    status: "generated_framing",
    validationStatus: "not_checked",
    citationIds: [],
    derivedFromClaimIds: [],
  };
}

function alreadyHasFraming(sectionMarkdown: string, framing: string) {
  return sectionMarkdown
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .includes(framing.trim());
}

export function strengthenDraftNarrative(
  draft: ValidatedDraft,
  investorSegment: InvestorSegment,
  audienceTailoring?: AudienceTailoring,
  prospectusBuilder?: ProspectusBuilder,
): ValidatedDraft {
  const profile = getInvestorSegmentProfile(investorSegment);
  const normalizedTailoring = normalizeAudienceTailoring(
    audienceTailoring ?? draft.audienceTailoring,
  );
  const tailoringProfile = getAudienceTailoringProfile(normalizedTailoring);
  const builder = prospectusBuilder ?? draft.prospectusBuilder;
  const angleProfile = getNarrativeAngleProfile(builder.narrativeAngle);
  const claims = [...draft.claims];
  const narrativeChanges = new Set(draft.narrativeChanges);
  narrativeChanges.add(`Tailored framing for ${profile.label}.`);
  narrativeChanges.add(
    `Audience tailoring applied: ${tailoringProfile.label}.`,
  );
  narrativeChanges.add(`Narrative angle applied: ${angleProfile.label}.`);
  const framingStatements = [
    profile.propositionLens,
    tailoringProfile.propositionLens,
    angleProfile.lens,
  ];

  const sections = draft.sections.map((section) => {
    if (
      ![
        "investment_proposition",
        "why_this_is_investable",
        "investor_relevance",
        "interest_thesis",
        "investable_concept",
        "donor_fit",
        "donor_hook",
        "decision_context",
        "concept_summary",
        "next_conversation",
        "donor_invitation",
      ].includes(section.sectionKey)
    ) {
      return section;
    }

    const missingFraming = framingStatements.filter(
      (framing) => !alreadyHasFraming(section.renderedMarkdown, framing),
    );

    if (missingFraming.length === 0) {
      return section;
    }

    const newClaims = missingFraming.map(framingClaim);
    claims.push(...newClaims);

    return {
      ...section,
      renderedMarkdown: `${missingFraming.join("\n\n")}\n\n${section.renderedMarkdown}`,
      claimIds: [...newClaims.map((claim) => claim.id), ...section.claimIds],
    };
  });

  return ValidatedDraftSchema.parse({
    ...draft,
    investorSegment,
    audienceTailoring: normalizedTailoring,
    prospectusBuilder: builder,
    sections,
    claims,
    narrativeChanges: Array.from(narrativeChanges),
  });
}
