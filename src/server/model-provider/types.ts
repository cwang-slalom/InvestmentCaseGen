import type { z } from "zod";

import type { GenerationRecord } from "@/domain";

export type ModelOperation = GenerationRecord["runType"];

export type ModelProviderRequest<Input, Output> = {
  operation: ModelOperation;
  input: Input;
  schema: z.ZodType<Output>;
  promptVersion: string;
  externalWebSearch?: boolean;
  metadata?: Record<string, string>;
};

export type ModelProviderResponse<Output> = {
  output: Output;
  modelProvider: string;
  modelName: string;
  storedPayloadMode: GenerationRecord["storedPayloadMode"];
  redactedResponseJson?: unknown;
};

export interface ModelProvider {
  readonly providerName: string;
  readonly modelName: string;
  generateStructured<Input, Output>(
    request: ModelProviderRequest<Input, Output>,
  ): Promise<ModelProviderResponse<Output>>;
}
