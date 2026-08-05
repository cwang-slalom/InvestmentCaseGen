import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  VertexGeminiModelProvider,
  vertexGeminiTestHelpers,
} from "./vertex-gemini";

describe("VertexGeminiModelProvider", () => {
  it("parses JSON from model text candidates", () => {
    expect(
      vertexGeminiTestHelpers.parseJsonCandidate('```json\n{"ok":true}\n```'),
    ).toEqual({ ok: true });
    expect(
      vertexGeminiTestHelpers.parseJsonCandidate(
        'Result:\n{"items":[{"id":"one"}]}',
      ),
    ).toEqual({ items: [{ id: "one" }] });
  });

  it("calls Vertex generateContent and validates structured output", async () => {
    const provider = new VertexGeminiModelProvider({
      projectId: "project-1",
      location: "us-central1",
      modelName: "gemini-test",
      accessToken: "token-1",
      fetchImpl: async (input, init) => {
        expect(String(input)).toContain(
          "https://us-central1-aiplatform.googleapis.com/v1/projects/project-1/locations/us-central1/publishers/google/models/gemini-test:generateContent",
        );
        expect(init?.headers).toMatchObject({
          authorization: "Bearer token-1",
          "content-type": "application/json",
        });

        const body = JSON.parse(String(init?.body));
        expect(body.generationConfig.responseMimeType).toBe("application/json");
        expect(body.tools).toEqual([{ googleSearch: {} }]);

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: '{"ok":true}' }] },
                finishReason: "STOP",
              },
            ],
          }),
          { status: 200 },
        );
      },
    });

    const response = await provider.generateStructured({
      operation: "strengthen_narrative",
      promptVersion: "test",
      externalWebSearch: true,
      schema: z.object({ ok: z.literal(true) }),
      input: { prompt: "Return ok.", value: "test" },
    });

    expect(response.output).toEqual({ ok: true });
    expect(response.modelProvider).toBe("vertex-gemini");
    expect(response.storedPayloadMode).toBe("validated_outputs_only");
  });

  it("uses the global Vertex endpoint for global location", async () => {
    const provider = new VertexGeminiModelProvider({
      projectId: "project-1",
      location: "global",
      modelName: "gemini-test",
      accessToken: "token-1",
      fetchImpl: async (input) => {
        expect(String(input)).toContain(
          "https://aiplatform.googleapis.com/v1/projects/project-1/locations/global/publishers/google/models/gemini-test:generateContent",
        );

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: '{"ok":true}' }] },
                finishReason: "STOP",
              },
            ],
          }),
          { status: 200 },
        );
      },
    });

    const response = await provider.generateStructured({
      operation: "strengthen_narrative",
      promptVersion: "test",
      schema: z.object({ ok: z.literal(true) }),
      input: { prompt: "Return ok." },
    });

    expect(response.output).toEqual({ ok: true });
  });

  it("supports authorized_user credentials files used by gcloud ADC", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "vertex-adc-test-"));
    const credentialsPath = path.join(tempDir, "adc.json");
    await writeFile(
      credentialsPath,
      JSON.stringify({
        type: "authorized_user",
        client_id: "client-id-1",
        client_secret: "client-secret-1",
        refresh_token: "refresh-token-1",
      }),
      "utf8",
    );

    let tokenCallCount = 0;
    let vertexCallCount = 0;
    const provider = new VertexGeminiModelProvider({
      projectId: "project-1",
      location: "us-central1",
      modelName: "gemini-test",
      credentialsPath,
      fetchImpl: async (input, init) => {
        const url = String(input);

        if (url.includes("oauth2.googleapis.com/token")) {
          tokenCallCount += 1;
          expect(init?.body?.toString()).toContain("grant_type=refresh_token");
          return new Response(
            JSON.stringify({
              access_token: "adc-access-token",
              expires_in: 3600,
            }),
            { status: 200 },
          );
        }

        vertexCallCount += 1;
        expect(url).toContain(
          "publishers/google/models/gemini-test:generateContent",
        );
        expect(init?.headers).toMatchObject({
          authorization: "Bearer adc-access-token",
        });

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"ok":true,"source":"authorized_user"}' }],
                },
                finishReason: "STOP",
              },
            ],
          }),
          { status: 200 },
        );
      },
    });

    const response = await provider.generateStructured({
      operation: "extract_opportunities",
      promptVersion: "test",
      schema: z.object({
        ok: z.literal(true),
        source: z.literal("authorized_user"),
      }),
      input: { prompt: "Return ok." },
    });

    expect(response.output).toEqual({
      ok: true,
      source: "authorized_user",
    });
    expect(tokenCallCount).toBe(1);
    expect(vertexCallCount).toBe(1);
  });
});
