import { describe, expect, it } from "vitest";
import { z } from "zod";

import { BackendModelProvider } from "./backend";

describe("BackendModelProvider", () => {
  it("delegates structured generation to the FastAPI AI endpoint", async () => {
    const provider = new BackendModelProvider({
      baseUrl: "http://localhost:8000/",
      fetchImpl: async (input, init) => {
        expect(String(input)).toBe("http://localhost:8000/ai/structured");
        expect(init?.headers).toMatchObject({
          "content-type": "application/json",
        });

        const body = JSON.parse(String(init?.body));
        expect(body.operation).toBe("render_executive_investment_case");
        expect(body.externalWebSearch).toBe(true);
        expect(body.input).toEqual({ value: "hello" });
        expect(body.jsonSchema).toBeDefined();
        expect(body.metadata).toEqual({
          promptName: "generate-investment-case",
        });

        return new Response(
          JSON.stringify({
            output: { ok: true },
            modelProvider: "backend-vertex-gemini",
            modelName: "gemini-test",
            storedPayloadMode: "validated_outputs_only",
          }),
          { status: 200 },
        );
      },
    });

    const response = await provider.generateStructured({
      operation: "render_executive_investment_case",
      promptVersion: "test",
      externalWebSearch: true,
      schema: z.object({ ok: z.literal(true) }),
      input: { prompt: "Return ok.", value: "hello" },
      metadata: { promptName: "generate-investment-case" },
    });

    expect(response.output).toEqual({ ok: true });
    expect(response.modelProvider).toBe("backend-vertex-gemini");
  });
});
