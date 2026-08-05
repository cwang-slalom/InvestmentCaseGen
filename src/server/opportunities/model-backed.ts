import { randomUUID } from "node:crypto";
import { z } from "zod";

import { OpportunitySchema } from "@/domain";
import type { SourceChunk } from "@/domain";
import type { ModelProvider } from "@/server/model-provider";
import { loadPrompt } from "@/server/prompts";
import type { Storage } from "@/server/storage";

const ModelOpportunityExtractionSchema = z.object({
  opportunities: z.array(OpportunitySchema).max(1).default([]),
});

export async function generateOpportunitiesWithModel({
  chunks,
  provider,
}: {
  chunks: SourceChunk[];
  provider: ModelProvider;
}) {
  const prompt = await loadPrompt("extract-opportunities");
  const response = await provider.generateStructured({
    operation: "extract_opportunities",
    promptVersion: prompt.version,
    schema: ModelOpportunityExtractionSchema,
    input: {
      chunks: chunks.map((chunk) => ({
        id: chunk.id,
        text: chunk.text,
        citation: chunk.citation,
      })),
    },
    metadata: {
      promptName: prompt.name,
    },
  });

  return { prompt, response };
}

export async function extractOpportunitiesWithModel({
  projectId,
  chunks,
  provider,
  storage,
}: {
  projectId: string;
  chunks: SourceChunk[];
  provider: ModelProvider;
  storage?: Storage;
}) {
  const { prompt, response } = await generateOpportunitiesWithModel({
    chunks,
    provider,
  });

  if (storage) {
    await storage.createGenerationRun({
      id: randomUUID(),
      projectId,
      runType: "extract_opportunities",
      promptName: prompt.name,
      promptVersion: prompt.version,
      modelProvider: response.modelProvider,
      modelName: response.modelName,
      inputChunkIds: chunks.map((chunk) => chunk.id),
      status: "completed",
      storedPayloadMode: response.storedPayloadMode,
    });
  }

  return response.output.opportunities;
}
