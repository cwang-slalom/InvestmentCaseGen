import { randomUUID } from "node:crypto";

import type {
  AudienceTailoring,
  DraftRecord,
  InvestorSegment,
  OpportunityRecord,
  OutputType,
  ProspectusBuilder,
} from "@/domain";
import {
  generationRunTypeForOutput,
  normalizeProspectusBuilder,
} from "@/domain";
import type { ModelProvider } from "@/server/model-provider";
import { loadPrompt } from "@/server/prompts";
import type { Storage } from "@/server/storage";

import { loadOpportunityCitations } from "./evidence";
import { generateDraftWithModel } from "./model-draft";
import { strengthenDraftNarrativeWithModel } from "./model-strengthen";
import { renderDraft } from "./render";
import { normalizeAudienceTailoring } from "./segments";

function promptNameForOutput(outputType: OutputType) {
  return outputType === "opportunity_spotlight"
    ? "generate-opportunity-spotlight"
    : "generate-investment-case";
}

export async function createDraftForOpportunity({
  storage,
  record,
  outputType,
  investorSegment,
  audienceTailoring,
  prospectusBuilder,
  strengthenNarrative = true,
  externalWebSearch = false,
  provider,
}: {
  storage: Storage;
  record: OpportunityRecord;
  outputType: OutputType;
  investorSegment: InvestorSegment;
  audienceTailoring?: AudienceTailoring;
  prospectusBuilder?: ProspectusBuilder;
  strengthenNarrative?: boolean;
  externalWebSearch?: boolean;
  provider?: ModelProvider;
}): Promise<DraftRecord> {
  const normalizedTailoring = normalizeAudienceTailoring(audienceTailoring);
  const normalizedBuilder = normalizeProspectusBuilder(prospectusBuilder);
  const prompt = await loadPrompt(promptNameForOutput(outputType));
  const citations = await loadOpportunityCitations(
    storage,
    record.sourceDocumentIds,
  );
  let draft = renderDraft(record, citations, {
    outputType,
    investorSegment,
    audienceTailoring: normalizedTailoring,
    prospectusBuilder: normalizedBuilder,
    strengthenNarrative,
  });
  let generationRunId: string | undefined;
  const renderRunType = generationRunTypeForOutput(outputType);

  if (provider) {
    try {
      const modelDraft = await generateDraftWithModel({
        scaffold: draft,
        citations,
        investorSegment,
        audienceTailoring: normalizedTailoring,
        prospectusBuilder: normalizedBuilder,
        externalWebSearch,
        provider,
      });
      draft = modelDraft.draft;
      const modelRun = await storage.createGenerationRun({
        id: randomUUID(),
        projectId: record.projectId,
        opportunityId: record.opportunity.id,
        runType: renderRunType,
        promptName: modelDraft.prompt.name,
        promptVersion: modelDraft.prompt.version,
        modelProvider: modelDraft.response.modelProvider,
        modelName: modelDraft.response.modelName,
        inputChunkIds: citations
          .map((citation) => citation.chunkId)
          .filter((chunkId): chunkId is string => Boolean(chunkId)),
        validationResult: draft.validation,
        status: "completed",
        storedPayloadMode: modelDraft.response.storedPayloadMode,
      });
      generationRunId = modelRun.id;
    } catch (error) {
      console.warn(
        "Model-authored draft generation failed; keeping deterministic draft.",
        error instanceof Error ? error.message : "Unknown model error.",
      );
      const failedRun = await storage.createGenerationRun({
        id: randomUUID(),
        projectId: record.projectId,
        opportunityId: record.opportunity.id,
        runType: renderRunType,
        promptName: prompt.name,
        promptVersion: prompt.version,
        modelProvider: provider.providerName,
        modelName: provider.modelName,
        inputChunkIds: citations
          .map((citation) => citation.chunkId)
          .filter((chunkId): chunkId is string => Boolean(chunkId)),
        status: "failed",
        storedPayloadMode: "validated_outputs_only",
      });
      generationRunId = failedRun.id;
    }
  }

  if (!generationRunId) {
    const generationRun = await storage.createGenerationRun({
      id: randomUUID(),
      projectId: record.projectId,
      opportunityId: record.opportunity.id,
      runType: renderRunType,
      promptName: prompt.name,
      promptVersion: prompt.version,
      modelProvider: "deterministic",
      modelName: "source-grounded-draft-renderer-v1",
      inputChunkIds: citations
        .map((citation) => citation.chunkId)
        .filter((chunkId): chunkId is string => Boolean(chunkId)),
      validationResult: draft.validation,
      status: "completed",
      storedPayloadMode: "validated_outputs_only",
    });
    generationRunId = generationRun.id;
  }

  if (provider && strengthenNarrative) {
    try {
      const strengthened = await strengthenDraftNarrativeWithModel({
        draft,
        investorSegment,
        audienceTailoring: normalizedTailoring,
        prospectusBuilder: normalizedBuilder,
        externalWebSearch,
        provider,
      });
      draft = strengthened.draft;
      const strengthenRun = await storage.createGenerationRun({
        id: randomUUID(),
        projectId: record.projectId,
        opportunityId: record.opportunity.id,
        runType: "strengthen_narrative",
        promptName: strengthened.prompt.name,
        promptVersion: strengthened.prompt.version,
        modelProvider: strengthened.response.modelProvider,
        modelName: strengthened.response.modelName,
        inputChunkIds: citations
          .map((citation) => citation.chunkId)
          .filter((chunkId): chunkId is string => Boolean(chunkId)),
        validationResult: draft.validation,
        status: "completed",
        storedPayloadMode: strengthened.response.storedPayloadMode,
      });
      generationRunId = strengthenRun.id;
    } catch (error) {
      console.warn(
        "Model-backed narrative strengthening failed; keeping deterministic draft.",
        error instanceof Error ? error.message : "Unknown model error.",
      );
      const failedPrompt = await loadPrompt("strengthen-narrative");
      await storage.createGenerationRun({
        id: randomUUID(),
        projectId: record.projectId,
        opportunityId: record.opportunity.id,
        runType: "strengthen_narrative",
        promptName: failedPrompt.name,
        promptVersion: failedPrompt.version,
        modelProvider: provider.providerName,
        modelName: provider.modelName,
        inputChunkIds: citations
          .map((citation) => citation.chunkId)
          .filter((chunkId): chunkId is string => Boolean(chunkId)),
        status: "failed",
        storedPayloadMode: "validated_outputs_only",
      });
    }
  }

  return storage.createDraftRecord({
    id: draft.id,
    projectId: record.projectId,
    opportunityRecordId: record.id,
    opportunityId: record.opportunity.id,
    outputType: draft.outputType,
    investorSegment: draft.investorSegment,
    draft,
    generationRunId,
  });
}
