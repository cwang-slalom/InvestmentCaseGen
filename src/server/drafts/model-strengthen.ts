import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  ValidatedDraftSchema,
  getNarrativeAngleProfile,
  getOutputFormatProfile,
  type AudienceTailoring,
  type DraftSection,
  type InvestorSegment,
  type OpportunityClaim,
  type ProspectusBuilder,
  type ValidatedDraft,
} from "@/domain";
import type {
  ModelProvider,
  ModelProviderResponse,
} from "@/server/model-provider";
import type { LoadedPrompt } from "@/server/prompts";
import { loadPrompt } from "@/server/prompts";

import { evaluateDraftQuality } from "./evaluation";
import { validateDraftClaims } from "./validation";

const ModelNarrativeStrengtheningSchema = z.object({
  narrativeChanges: z.array(z.string().min(1).max(240)).max(8).default([]),
  sectionAdditions: z
    .array(
      z.object({
        sectionKey: z.string().min(1),
        framingParagraph: z.string().min(1).max(700),
      }),
    )
    .max(4)
    .default([]),
  behavioralImprovements: z
    .array(z.string().min(1).max(400))
    .max(5)
    .default([]),
  visualSuggestions: z.array(z.string().min(1).max(400)).max(5).default([]),
  factsNeedingEvidence: z.array(z.string().min(1).max(400)).max(8).default([]),
});

export type ModelNarrativeStrengthening = z.infer<
  typeof ModelNarrativeStrengtheningSchema
>;

const allowedInsertionSections = new Set([
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
]);

const numberPattern =
  /(?:\b\d+(?:,\d{3})*(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s?(?:%|percent|million|billion|thousand)\b)/i;

function safeGeneratedText(value: string) {
  const text = value.replace(/\s+/g, " ").trim();

  if (!text || numberPattern.test(text)) {
    return undefined;
  }

  if (
    /(?:funding recipient|investment vehicle|investment manager)\s+(?:is|are|will be|should be)/i.test(
      text,
    )
  ) {
    return undefined;
  }

  return text;
}

function generatedClaim(statement: string): OpportunityClaim {
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

function addGeneratedParagraph(
  section: DraftSection,
  statement: string,
  claim: OpportunityClaim,
): DraftSection {
  return {
    ...section,
    renderedMarkdown: `${statement}\n\n${section.renderedMarkdown}`,
    claimIds: [claim.id, ...section.claimIds],
  };
}

function appendGeneratedList(
  section: DraftSection,
  statements: string[],
  claims: OpportunityClaim[],
): DraftSection {
  if (statements.length === 0) {
    return section;
  }

  return {
    ...section,
    renderedMarkdown: `${section.renderedMarkdown}\n\n${statements
      .map((statement) => `- ${statement}`)
      .join("\n")}`,
    claimIds: [...section.claimIds, ...claims.map((claim) => claim.id)],
  };
}

function applyListSuggestions({
  sections,
  claims,
  sectionKey,
  suggestions,
}: {
  sections: DraftSection[];
  claims: OpportunityClaim[];
  sectionKey: string;
  suggestions: string[];
}) {
  const safeSuggestions = suggestions
    .map(safeGeneratedText)
    .filter((item): item is string => Boolean(item));
  if (safeSuggestions.length === 0) {
    return sections;
  }

  const newClaims = safeSuggestions.map(generatedClaim);
  claims.push(...newClaims);

  return sections.map((section) =>
    section.sectionKey === sectionKey
      ? appendGeneratedList(section, safeSuggestions, newClaims)
      : section,
  );
}

export function applyModelNarrativeStrengthening(
  draft: ValidatedDraft,
  output: ModelNarrativeStrengthening,
): ValidatedDraft {
  const claims = [...draft.claims];
  let sections = [...draft.sections];
  const narrativeChanges = new Set(draft.narrativeChanges);

  for (const change of output.narrativeChanges) {
    const safeChange = safeGeneratedText(change);
    if (safeChange) {
      narrativeChanges.add(safeChange);
    }
  }

  for (const addition of output.sectionAdditions) {
    if (!allowedInsertionSections.has(addition.sectionKey)) {
      continue;
    }

    const statement = safeGeneratedText(addition.framingParagraph);
    if (!statement) {
      continue;
    }

    const claim = generatedClaim(statement);
    claims.push(claim);
    sections = sections.map((section) =>
      section.sectionKey === addition.sectionKey
        ? addGeneratedParagraph(section, statement, claim)
        : section,
    );
    narrativeChanges.add(
      `AI narrative framing added to ${addition.sectionKey}.`,
    );
  }

  sections = applyListSuggestions({
    sections,
    claims,
    sectionKey: "donor_language_and_behavioral_framing",
    suggestions: output.behavioralImprovements,
  });
  sections = applyListSuggestions({
    sections,
    claims,
    sectionKey: "visual_brief",
    suggestions: output.visualSuggestions,
  });
  sections = applyListSuggestions({
    sections,
    claims,
    sectionKey: "evidence_gaps",
    suggestions: output.factsNeedingEvidence.map(
      (fact) => `Needs evidence: ${fact}`,
    ),
  });

  if (
    output.behavioralImprovements.length > 0 ||
    output.visualSuggestions.length > 0 ||
    output.factsNeedingEvidence.length > 0
  ) {
    narrativeChanges.add("AI narrative suggestions reviewed for safe framing.");
  }

  const strengthened = ValidatedDraftSchema.parse({
    ...draft,
    sections,
    claims,
    narrativeChanges: Array.from(narrativeChanges),
  });
  const validation = validateDraftClaims(strengthened);
  const productQualityEvaluation = evaluateDraftQuality({
    ...strengthened,
    validation,
  });

  return ValidatedDraftSchema.parse({
    ...strengthened,
    validation,
    productQualityEvaluation,
  });
}

export async function strengthenDraftNarrativeWithModel({
  draft,
  investorSegment,
  audienceTailoring,
  prospectusBuilder,
  externalWebSearch = false,
  provider,
}: {
  draft: ValidatedDraft;
  investorSegment: InvestorSegment;
  audienceTailoring: AudienceTailoring;
  prospectusBuilder: ProspectusBuilder;
  externalWebSearch?: boolean;
  provider: ModelProvider;
}): Promise<{
  draft: ValidatedDraft;
  prompt: LoadedPrompt;
  response: ModelProviderResponse<ModelNarrativeStrengthening>;
}> {
  const prompt = await loadPrompt("strengthen-narrative");
  const outputFormat = getOutputFormatProfile(draft.outputType);
  const narrativeAngle = getNarrativeAngleProfile(
    prospectusBuilder.narrativeAngle,
  );
  const response = await provider.generateStructured({
    operation: "strengthen_narrative",
    promptVersion: prompt.version,
    externalWebSearch,
    schema: ModelNarrativeStrengtheningSchema,
    input: {
      investorSegment,
      audienceTailoring,
      prospectusBuilder,
      outputFormat,
      narrativeAngle,
      draft: {
        title: draft.title,
        outputType: draft.outputType,
        audienceTailoring: draft.audienceTailoring,
        prospectusBuilder: draft.prospectusBuilder,
        variant: draft.variant,
        draftNotice: draft.draftNotice,
        sections: draft.sections.map((section) => ({
          sectionKey: section.sectionKey,
          title: section.title,
          renderedMarkdown: section.renderedMarkdown,
          warningText: section.warningText,
        })),
        citations: draft.citations.map((citation) => ({
          id: citation.id,
          filename: citation.filename,
          pageNumber: citation.pageNumber,
          slideNumber: citation.slideNumber,
          sectionHeading: citation.sectionHeading,
          excerpt: citation.excerpt,
        })),
        evidenceGaps: draft.evidenceGaps,
      },
    },
    metadata: {
      promptName: prompt.name,
    },
  });

  return {
    prompt,
    response,
    draft: applyModelNarrativeStrengthening(draft, response.output),
  };
}
