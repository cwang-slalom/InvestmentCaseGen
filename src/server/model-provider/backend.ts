import { z } from "zod";

import type {
  ModelProvider,
  ModelProviderRequest,
  ModelProviderResponse,
} from "./types";

type BackendModelProviderOptions = {
  baseUrl: string;
  modelName?: string;
  fetchImpl?: typeof fetch;
};

type BackendStructuredResponse = {
  output: unknown;
  modelProvider: string;
  modelName: string;
  storedPayloadMode: "validated_outputs_only" | "redacted_development";
  redactedResponseJson?: unknown;
};

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function removePromptFields(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const rest = { ...(input as Record<string, unknown>) };
  delete rest.prompt;
  delete rest.systemPrompt;
  delete rest.taskPrompt;

  return rest;
}

export class BackendModelProvider implements ModelProvider {
  readonly providerName = "backend";
  readonly modelName: string;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BackendModelProviderOptions) {
    this.baseUrl = normalizedBaseUrl(options.baseUrl);
    this.modelName = options.modelName ?? "backend-configured-model";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateStructured<Input, Output>(
    request: ModelProviderRequest<Input, Output>,
  ): Promise<ModelProviderResponse<Output>> {
    const response = await this.fetchImpl(`${this.baseUrl}/ai/structured`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation: request.operation,
        promptVersion: request.promptVersion,
        externalWebSearch: request.externalWebSearch ?? false,
        input: removePromptFields(request.input),
        jsonSchema: z.toJSONSchema(request.schema),
        metadata: request.metadata,
      }),
    });

    const body = (await response.json()) as
      BackendStructuredResponse | { detail?: string };

    if (!response.ok) {
      throw new Error(
        "detail" in body && body.detail
          ? body.detail
          : `Backend model request failed with status ${response.status}.`,
      );
    }

    const structured = body as BackendStructuredResponse;
    return {
      output: request.schema.parse(structured.output),
      modelProvider: structured.modelProvider,
      modelName: structured.modelName,
      storedPayloadMode: structured.storedPayloadMode,
      redactedResponseJson: structured.redactedResponseJson,
    };
  }
}
