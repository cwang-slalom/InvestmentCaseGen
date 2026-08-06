import { BackendModelProvider } from "./backend";
import { MockModelProvider } from "./mock";
import type { ModelProvider } from "./types";
import { VertexGeminiModelProvider } from "./vertex-gemini";

type Env = Record<string, string | undefined>;

type ProviderOptions = {
  allowMock?: boolean;
  env?: Env;
};

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function truthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(normalized(value) ?? "");
}

function numberFromEnv(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function hasVertexSignal(env: Env) {
  return Boolean(
    truthy(env.GOOGLE_GENAI_USE_VERTEXAI) ||
    env.VERTEX_AI_MODEL ||
    env.LIVE_API_MODEL ||
    env.GOOGLE_CLOUD_PROJECT,
  );
}

function hasDatabricksSignal(env: Env) {
  return Boolean(
    env.DATABRICKS_MODEL_SERVING_ENDPOINT ||
    env.DATABRICKS_MODEL ||
    env.DATABRICKS_HOST,
  );
}

function hasAnthropicSignal(env: Env) {
  return Boolean(env.ANTHROPIC_MODEL || env.CLAUDE_MODEL);
}

function backendBaseUrl(env: Env) {
  return env.GENAI_BACKEND_BASE_URL ?? env.NEXT_PUBLIC_API_BASE_URL;
}

function backendModelName(env: Env) {
  const explicit = normalized(env.MODEL_PROVIDER_MODE);

  if (
    explicit === "databricks" ||
    explicit === "databricks-model-serving" ||
    explicit === "mosaic" ||
    explicit === "mosaic-ai"
  ) {
    return env.DATABRICKS_MODEL_SERVING_ENDPOINT ?? env.DATABRICKS_MODEL;
  }

  if (explicit === "anthropic" || explicit === "claude") {
    return env.ANTHROPIC_MODEL ?? env.CLAUDE_MODEL;
  }

  if (
    explicit === "vertex" ||
    explicit === "vertex-gemini" ||
    explicit === "gemini"
  ) {
    return env.VERTEX_AI_MODEL ?? env.LIVE_API_MODEL;
  }

  return (
    env.DATABRICKS_MODEL_SERVING_ENDPOINT ??
    env.DATABRICKS_MODEL ??
    env.ANTHROPIC_MODEL ??
    env.CLAUDE_MODEL ??
    env.VERTEX_AI_MODEL ??
    env.LIVE_API_MODEL
  );
}

export function getModelProviderMode(env: Env = process.env) {
  const explicit = normalized(env.MODEL_PROVIDER_MODE);
  if (
    explicit === "deterministic" ||
    explicit === "none" ||
    explicit === "off"
  ) {
    return "deterministic" as const;
  }

  if (explicit === "mock") {
    return "mock" as const;
  }

  if (
    explicit === "backend" ||
    explicit === "fastapi" ||
    explicit === "python-backend" ||
    explicit === "databricks" ||
    explicit === "databricks-model-serving" ||
    explicit === "mosaic" ||
    explicit === "mosaic-ai" ||
    explicit === "anthropic" ||
    explicit === "claude"
  ) {
    return "backend" as const;
  }

  if (
    explicit === "vertex" ||
    explicit === "vertex-gemini" ||
    explicit === "gemini"
  ) {
    return "backend" as const;
  }

  if (
    explicit === "vertex-direct" ||
    explicit === "direct-vertex" ||
    explicit === "local-vertex"
  ) {
    return "vertex-direct" as const;
  }

  if (truthy(env.USE_MOCK_AI)) {
    return "mock" as const;
  }

  if (backendBaseUrl(env)) {
    return "backend" as const;
  }

  if (hasVertexSignal(env)) {
    return "backend" as const;
  }

  if (hasDatabricksSignal(env)) {
    return "backend" as const;
  }

  if (hasAnthropicSignal(env)) {
    return "backend" as const;
  }

  return "deterministic" as const;
}

export function getConfiguredModelProvider({
  allowMock = false,
  env = process.env,
}: ProviderOptions = {}): ModelProvider | undefined {
  const mode = getModelProviderMode(env);

  if (mode === "mock") {
    return allowMock ? new MockModelProvider() : undefined;
  }

  if (mode !== "backend" && mode !== "vertex-direct") {
    return undefined;
  }

  const backendUrl = backendBaseUrl(env);
  if (mode === "backend") {
    if (!backendUrl) {
      return undefined;
    }

    return new BackendModelProvider({
      baseUrl: backendUrl,
      modelName: backendModelName(env),
    });
  }

  const projectId = env.GOOGLE_CLOUD_PROJECT;
  const location = env.VERTEX_AI_LOCATION ?? env.GOOGLE_CLOUD_LOCATION;
  const modelName = env.VERTEX_AI_MODEL ?? env.LIVE_API_MODEL;

  if (!projectId || !location || !modelName) {
    return undefined;
  }

  return new VertexGeminiModelProvider({
    projectId,
    location,
    modelName,
    credentialsPath: env.GOOGLE_APPLICATION_CREDENTIALS,
    accessToken: env.GOOGLE_OAUTH_ACCESS_TOKEN,
    maxOutputTokens: numberFromEnv(env.MODEL_MAX_OUTPUT_TOKENS),
  });
}
