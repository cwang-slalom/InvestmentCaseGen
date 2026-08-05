import { z } from "zod";

import {
  ValidatedDraftSchema,
  type AudienceTailoring,
  type Citation,
  type DraftSection,
  type InvestorSegment,
  type ProspectusBuilder,
  type ValidatedDraft,
  generationRunTypeForOutput,
  getNarrativeAngleProfile,
  getOutputFormatProfile,
} from "@/domain";
import type {
  ModelProvider,
  ModelProviderResponse,
} from "@/server/model-provider";
import type { LoadedPrompt } from "@/server/prompts";
import { loadPrompt } from "@/server/prompts";

import { evaluateDraftQuality } from "./evaluation";
import { validateDraftClaims } from "./validation";

const ModelAuthoredDraftSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  narrativeChanges: z.array(z.string().min(1).max(240)).max(12).default([]),
  sections: z
    .array(
      z.object({
        sectionKey: z.string().min(1),
        renderedMarkdown: z.string().min(1).max(5000),
      }),
    )
    .min(1),
});

export type ModelAuthoredDraft = z.infer<typeof ModelAuthoredDraftSchema>;

const numberPattern =
  /\b\d+(?:,\d{3})*(?:\.\d+)?(?:\s?(?:%|percent|million|billion|thousand))?\b/gi;

function numberTokens(value: string) {
  return new Set(
    value.match(numberPattern)?.map((token) => token.trim()) ?? [],
  );
}

function hasUnsupportedNumbers(candidate: string, allowedSourceText: string) {
  const allowed = numberTokens(allowedSourceText);

  return [...numberTokens(candidate)].some((token) => !allowed.has(token));
}

function shouldKeepOriginalSection({
  section,
  candidateMarkdown,
  allowedSourceText,
}: {
  section: DraftSection;
  candidateMarkdown: string | undefined;
  allowedSourceText: string;
}) {
  if (!candidateMarkdown?.trim()) {
    return true;
  }

  if (hasUnsupportedNumbers(candidateMarkdown, allowedSourceText)) {
    return true;
  }

  const originalMarkedUnresolved = section.renderedMarkdown.includes(
    "Not established in the provided source materials.",
  );
  const candidateRemovedUnresolved = !candidateMarkdown.includes(
    "Not established in the provided source materials.",
  );

  return originalMarkedUnresolved && candidateRemovedUnresolved;
}

export function applyModelAuthoredDraft({
  scaffold,
  modelDraft,
  citations,
}: {
  scaffold: ValidatedDraft;
  modelDraft: ModelAuthoredDraft;
  citations: Citation[];
}): ValidatedDraft {
  const modelSections = new Map(
    modelDraft.sections.map((section) => [
      section.sectionKey,
      section.renderedMarkdown.trim(),
    ]),
  );
  const allowedSourceText = [
    ...scaffold.sections.map((section) => section.renderedMarkdown),
    ...scaffold.claims.map((claim) => claim.statement),
    ...citations.map((citation) => citation.excerpt),
  ].join("\n");
  const sections = scaffold.sections.map((section) => {
    const candidateMarkdown = modelSections.get(section.sectionKey);

    if (
      shouldKeepOriginalSection({
        section,
        candidateMarkdown,
        allowedSourceText,
      })
    ) {
      return section;
    }

    return {
      ...section,
      renderedMarkdown: candidateMarkdown!,
    };
  });
  const narrativeChanges = new Set(scaffold.narrativeChanges);

  narrativeChanges.add("Gemini authored draft section language.");
  for (const change of modelDraft.narrativeChanges) {
    narrativeChanges.add(change);
  }

  const draft = ValidatedDraftSchema.parse({
    ...scaffold,
    title: modelDraft.title ?? scaffold.title,
    sections,
    narrativeChanges: Array.from(narrativeChanges),
  });
  const validation = validateDraftClaims(draft);
  const productQualityEvaluation = evaluateDraftQuality({
    ...draft,
    validation,
  });

  return ValidatedDraftSchema.parse({
    ...draft,
    validation,
    productQualityEvaluation,
  });
}

export async function generateDraftWithModel({
  scaffold,
  citations,
  investorSegment,
  audienceTailoring,
  prospectusBuilder,
  externalWebSearch = false,
  provider,
}: {
  scaffold: ValidatedDraft;
  citations: Citation[];
  investorSegment: InvestorSegment;
  audienceTailoring: AudienceTailoring;
  prospectusBuilder: ProspectusBuilder;
  externalWebSearch?: boolean;
  provider: ModelProvider;
}): Promise<{
  draft: ValidatedDraft;
  prompt: LoadedPrompt;
  response: ModelProviderResponse<ModelAuthoredDraft>;
}> {
  const prompt = await loadPrompt(
    scaffold.outputType === "opportunity_spotlight"
      ? "generate-opportunity-spotlight"
      : "generate-investment-case",
  );
  const outputFormat = getOutputFormatProfile(scaffold.outputType);
  const narrativeAngle = getNarrativeAngleProfile(
    prospectusBuilder.narrativeAngle,
  );
  const response = await provider.generateStructured({
    operation: generationRunTypeForOutput(scaffold.outputType),
    promptVersion: prompt.version,
    externalWebSearch,
    schema: ModelAuthoredDraftSchema,
    input: {
      investorSegment,
      audienceTailoring,
      prospectusBuilder,
      outputFormat,
      narrativeAngle,
      scaffold: {
        title: scaffold.title,
        outputType: scaffold.outputType,
        audienceTailoring: scaffold.audienceTailoring,
        prospectusBuilder: scaffold.prospectusBuilder,
        variant: scaffold.variant,
        draftNotice: scaffold.draftNotice,
        sections: scaffold.sections.map((section) => ({
          sectionKey: section.sectionKey,
          title: section.title,
          renderedMarkdown: section.renderedMarkdown,
          warningText: section.warningText,
        })),
        evidenceGaps: scaffold.evidenceGaps,
        citations: citations.map((citation) => ({
          id: citation.id,
          filename: citation.filename,
          pageNumber: citation.pageNumber,
          slideNumber: citation.slideNumber,
          sectionHeading: citation.sectionHeading,
          excerpt: citation.excerpt,
        })),
      },
    },
    metadata: {
      promptName: prompt.name,
    },
  });

  return {
    prompt,
    response,
    draft: applyModelAuthoredDraft({
      scaffold,
      modelDraft: response.output,
      citations,
    }),
  };
}
