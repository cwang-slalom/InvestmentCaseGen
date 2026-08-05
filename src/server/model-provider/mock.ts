import type {
  ModelProvider,
  ModelProviderRequest,
  ModelProviderResponse,
} from "./types";

export class MockModelProvider implements ModelProvider {
  readonly providerName = "mock";
  readonly modelName = "deterministic-foundation-mock";

  constructor(private readonly resolver?: (request: unknown) => unknown) {}

  async generateStructured<Input, Output>(
    request: ModelProviderRequest<Input, Output>,
  ): Promise<ModelProviderResponse<Output>> {
    const candidate = this.resolver?.(request) ?? {};
    const output = request.schema.parse(candidate);

    return {
      output,
      modelProvider: this.providerName,
      modelName: this.modelName,
      storedPayloadMode: "validated_outputs_only",
    };
  }
}
