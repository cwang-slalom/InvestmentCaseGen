import { describe, expect, it } from "vitest";

import { getConfiguredModelProvider, getModelProviderMode } from "./config";

describe("model-provider config", () => {
  it("keeps mock mode out of application routes unless explicitly allowed", () => {
    const env = {
      USE_MOCK_AI: "true",
      GOOGLE_CLOUD_PROJECT: "project-1",
      VERTEX_AI_LOCATION: "us-central1",
      VERTEX_AI_MODEL: "gemini-test",
    };

    expect(getModelProviderMode(env)).toBe("mock");
    expect(getConfiguredModelProvider({ env })).toBeUndefined();
    expect(
      getConfiguredModelProvider({ env, allowMock: true })?.providerName,
    ).toBe("mock");
  });

  it("requires the FastAPI backend for live Gemini configuration by default", () => {
    const provider = getConfiguredModelProvider({
      env: {
        GOOGLE_GENAI_USE_VERTEXAI: "true",
        GOOGLE_CLOUD_PROJECT: "project-1",
        GOOGLE_CLOUD_LOCATION: "us-central1",
        LIVE_API_MODEL: "gemini-test",
        GOOGLE_OAUTH_ACCESS_TOKEN: "token",
      },
    });

    expect(provider).toBeUndefined();
  });

  it("keeps direct TypeScript Vertex available only when explicitly requested", () => {
    const provider = getConfiguredModelProvider({
      env: {
        MODEL_PROVIDER_MODE: "vertex-direct",
        GOOGLE_CLOUD_PROJECT: "project-1",
        GOOGLE_CLOUD_LOCATION: "us-central1",
        LIVE_API_MODEL: "gemini-test",
        GOOGLE_OAUTH_ACCESS_TOKEN: "token",
      },
    });

    expect(provider?.providerName).toBe("vertex-gemini");
    expect(provider?.modelName).toBe("gemini-test");
  });

  it("prefers the FastAPI backend for live Gemini calls when configured", () => {
    const provider = getConfiguredModelProvider({
      env: {
        GOOGLE_GENAI_USE_VERTEXAI: "true",
        GOOGLE_CLOUD_PROJECT: "project-1",
        VERTEX_AI_LOCATION: "us-central1",
        VERTEX_AI_MODEL: "gemini-test",
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
      },
    });

    expect(provider?.providerName).toBe("backend");
    expect(provider?.modelName).toBe("gemini-test");
  });

  it("uses the FastAPI backend for Databricks model serving mode", () => {
    const provider = getConfiguredModelProvider({
      env: {
        MODEL_PROVIDER_MODE: "databricks",
        DATABRICKS_HOST: "https://workspace.cloud.databricks.com",
        DATABRICKS_MODEL_SERVING_ENDPOINT: "system.ai.test-model",
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
      },
    });

    expect(provider?.providerName).toBe("backend");
    expect(provider?.modelName).toBe("system.ai.test-model");
  });

  it("uses the FastAPI backend for Claude mode", () => {
    const provider = getConfiguredModelProvider({
      env: {
        MODEL_PROVIDER_MODE: "anthropic",
        ANTHROPIC_API_KEY: "token",
        ANTHROPIC_MODEL: "claude-sonnet-5",
        VERTEX_AI_MODEL: "gemini-test",
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
      },
    });

    expect(provider?.providerName).toBe("backend");
    expect(provider?.modelName).toBe("claude-sonnet-5");
  });

  it("honors an explicit deterministic mode", () => {
    expect(
      getConfiguredModelProvider({
        env: {
          MODEL_PROVIDER_MODE: "deterministic",
          GOOGLE_CLOUD_PROJECT: "project-1",
          VERTEX_AI_LOCATION: "us-central1",
          VERTEX_AI_MODEL: "gemini-test",
        },
      }),
    ).toBeUndefined();
  });
});
