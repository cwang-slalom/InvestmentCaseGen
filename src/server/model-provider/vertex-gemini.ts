import { createSign } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { z } from "zod";

import type {
  ModelProvider,
  ModelProviderRequest,
  ModelProviderResponse,
} from "./types";

type FetchLike = typeof fetch;

type VertexGeminiOptions = {
  projectId: string;
  location: string;
  modelName: string;
  credentialsPath?: string;
  accessToken?: string;
  maxOutputTokens?: number;
  fetchImpl?: FetchLike;
};

type ServiceAccountCredentials = {
  type?: "service_account";
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type AuthorizedUserCredentials = {
  type?: "authorized_user";
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  quota_project_id?: string;
  token_uri?: string;
};

type GoogleCredentials = ServiceAccountCredentials | AuthorizedUserCredentials;

type CachedAccessToken = {
  value: string;
  expiresAtMs: number;
};

type VertexGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: unknown[];
      groundingSupports?: unknown[];
      retrievalMetadata?: unknown;
      searchEntryPoint?: {
        renderedContent?: string;
        sdkBlob?: string;
      };
    };
  }>;
  usageMetadata?: unknown;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const oauthScope = "https://www.googleapis.com/auth/cloud-platform";
const defaultTokenUri = "https://oauth2.googleapis.com/token";
const defaultAdcPath = path.join(
  os.homedir(),
  ".config",
  "gcloud",
  "application_default_credentials.json",
);

function base64Url(input: Buffer | string) {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;

  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function redactVertexResponse(body: VertexGenerateContentResponse) {
  return {
    finishReasons:
      body.candidates?.map((candidate) => candidate.finishReason) ?? [],
    usageMetadata: body.usageMetadata,
    groundingMetadata:
      body.candidates
        ?.map((candidate) => candidate.groundingMetadata)
        .filter((metadata): metadata is NonNullable<typeof metadata> =>
          Boolean(metadata),
        )
        .map((metadata) => ({
          webSearchQueries: metadata.webSearchQueries,
          groundingChunks: metadata.groundingChunks,
          groundingSupports: metadata.groundingSupports,
          retrievalMetadata: metadata.retrievalMetadata,
          hasSearchEntryPoint: Boolean(metadata.searchEntryPoint),
        })) ?? [],
  };
}

function parseJsonCandidate(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with common model-output cleanup paths.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    return JSON.parse(fenced.trim());
  }

  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    return JSON.parse(trimmed.slice(firstObject, lastObject + 1));
  }

  const firstArray = trimmed.indexOf("[");
  const lastArray = trimmed.lastIndexOf("]");
  if (firstArray >= 0 && lastArray > firstArray) {
    return JSON.parse(trimmed.slice(firstArray, lastArray + 1));
  }

  throw new Error("Model response did not contain valid JSON.");
}

function removePromptFromInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const rest = { ...(input as Record<string, unknown>) };
  delete rest.prompt;

  return rest;
}

function promptFromInput(input: unknown) {
  if (
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    typeof (input as { prompt?: unknown }).prompt === "string"
  ) {
    return (input as { prompt: string }).prompt;
  }

  return "";
}

function buildStructuredPrompt<Input, Output>(
  request: ModelProviderRequest<Input, Output>,
) {
  const jsonSchema = z.toJSONSchema(request.schema);
  const prompt = promptFromInput(request.input);
  const input = removePromptFromInput(request.input);

  return [
    prompt,
    "",
    "Return only valid JSON for this operation.",
    `Operation: ${request.operation}`,
    "",
    "Structured output schema:",
    JSON.stringify(jsonSchema),
    "",
    "Input:",
    JSON.stringify(input),
  ]
    .filter(Boolean)
    .join("\n");
}

function vertexEndpointBase(location: string) {
  return location === "global"
    ? "https://aiplatform.googleapis.com"
    : `https://${location}-aiplatform.googleapis.com`;
}

async function fileExists(candidatePath: string) {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

function isAuthorizedUserCredentials(
  credentials: GoogleCredentials,
): credentials is AuthorizedUserCredentials {
  return credentials.type === "authorized_user";
}

function isServiceAccountCredentials(
  credentials: GoogleCredentials,
): credentials is ServiceAccountCredentials {
  return (
    credentials.type === "service_account" ||
    ("client_email" in credentials && "private_key" in credentials)
  );
}

export class VertexGeminiModelProvider implements ModelProvider {
  readonly providerName = "vertex-gemini";
  readonly modelName: string;

  private readonly projectId: string;
  private readonly location: string;
  private readonly credentialsPath?: string;
  private readonly staticAccessToken?: string;
  private readonly maxOutputTokens: number;
  private readonly fetchImpl: FetchLike;
  private cachedAccessToken?: CachedAccessToken;

  constructor(options: VertexGeminiOptions) {
    this.projectId = options.projectId;
    this.location = options.location;
    this.modelName = options.modelName;
    this.credentialsPath = options.credentialsPath;
    this.staticAccessToken = options.accessToken;
    this.maxOutputTokens = options.maxOutputTokens ?? 8192;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateStructured<Input, Output>(
    request: ModelProviderRequest<Input, Output>,
  ): Promise<ModelProviderResponse<Output>> {
    const accessToken = await this.getAccessToken();
    const url = `${vertexEndpointBase(this.location)}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.modelName}:generateContent`;
    const payload: Record<string, unknown> = {
      systemInstruction: {
        role: "system",
        parts: [
          {
            text: [
              "You are a source-grounded investment case assistant.",
              "Use only provided source text and citations for factual claims.",
              "Never infer a funding recipient or investment vehicle without explicit source evidence.",
              "Keep unresolved fields visibly unresolved.",
              "Return JSON only.",
            ].join(" "),
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildStructuredPrompt(request) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: this.maxOutputTokens,
        responseMimeType: "application/json",
      },
    };

    if (request.externalWebSearch) {
      payload.tools = [{ googleSearch: {} }];
    }

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as VertexGenerateContentResponse;
    if (!response.ok || body.error) {
      throw new Error(
        body.error?.message ??
          `Vertex Gemini request failed with status ${response.status}.`,
      );
    }

    const text =
      body.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text)
        .filter((part): part is string => Boolean(part))
        .join("\n")
        .trim() ?? "";

    if (!text) {
      throw new Error("Vertex Gemini returned no text candidate.");
    }

    const output = request.schema.parse(parseJsonCandidate(text));

    return {
      output,
      modelProvider: this.providerName,
      modelName: this.modelName,
      storedPayloadMode: "validated_outputs_only",
      redactedResponseJson: redactVertexResponse(body),
    };
  }

  private async getAccessToken() {
    if (this.staticAccessToken) {
      return this.staticAccessToken;
    }

    const now = Date.now();
    if (
      this.cachedAccessToken &&
      this.cachedAccessToken.expiresAtMs - now > 60_000
    ) {
      return this.cachedAccessToken.value;
    }

    const credentialsPath = await this.resolveCredentialsPath();
    const credentials = JSON.parse(
      await readFile(credentialsPath, "utf8"),
    ) as GoogleCredentials;

    if (isAuthorizedUserCredentials(credentials)) {
      return this.exchangeAuthorizedUserRefreshToken(credentials);
    }

    if (!isServiceAccountCredentials(credentials)) {
      throw new Error(
        "Google credentials must be a service account JSON or an application default credentials JSON file.",
      );
    }

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        "Service account credentials must include client_email and private_key.",
      );
    }

    return this.exchangeServiceAccountAssertion(credentials);
  }

  private async resolveCredentialsPath() {
    if (this.credentialsPath && (await fileExists(this.credentialsPath))) {
      return this.credentialsPath;
    }

    if (await fileExists(defaultAdcPath)) {
      return defaultAdcPath;
    }

    if (this.credentialsPath) {
      throw new Error(
        `Google credentials file was not found at ${this.credentialsPath}, and no application default credentials file was found at ${defaultAdcPath}.`,
      );
    }

    throw new Error(
      "Vertex Gemini requires GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_OAUTH_ACCESS_TOKEN, or a local gcloud application default credentials file.",
    );
  }

  private async exchangeServiceAccountAssertion(
    credentials: ServiceAccountCredentials,
  ) {
    const privateKey = credentials.private_key!;

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 3600;
    const assertionHeader = base64Url(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    );
    const assertionPayload = base64Url(
      JSON.stringify({
        iss: credentials.client_email,
        scope: oauthScope,
        aud: credentials.token_uri ?? defaultTokenUri,
        exp: expiresAt,
        iat: issuedAt,
      }),
    );
    const unsignedAssertion = `${assertionHeader}.${assertionPayload}`;
    const signature = createSign("RSA-SHA256")
      .update(unsignedAssertion)
      .sign(privateKey);
    const assertion = `${unsignedAssertion}.${base64Url(signature)}`;

    const tokenResponse = await this.fetchImpl(
      credentials.token_uri ?? defaultTokenUri,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      },
    );
    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    };

    return this.cacheAccessToken(
      tokenResponse.ok,
      tokenBody,
      tokenResponse.status,
    );
  }

  private async exchangeAuthorizedUserRefreshToken(
    credentials: AuthorizedUserCredentials,
  ) {
    if (
      !credentials.client_id ||
      !credentials.client_secret ||
      !credentials.refresh_token
    ) {
      throw new Error(
        "Application default credentials must include client_id, client_secret, and refresh_token.",
      );
    }

    const tokenResponse = await this.fetchImpl(
      credentials.token_uri ?? defaultTokenUri,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: credentials.client_id,
          client_secret: credentials.client_secret,
          refresh_token: credentials.refresh_token,
          grant_type: "refresh_token",
        }),
      },
    );
    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    };

    return this.cacheAccessToken(
      tokenResponse.ok,
      tokenBody,
      tokenResponse.status,
    );
  }

  private cacheAccessToken(
    ok: boolean,
    tokenBody: {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    },
    status: number,
  ) {
    if (!ok || !tokenBody.access_token) {
      throw new Error(
        tokenBody.error_description ??
          `Google OAuth token request failed with status ${status}.`,
      );
    }

    this.cachedAccessToken = {
      value: tokenBody.access_token,
      expiresAtMs: Date.now() + (tokenBody.expires_in ?? 3600) * 1000,
    };

    return this.cachedAccessToken.value;
  }
}

export const vertexGeminiTestHelpers = {
  parseJsonCandidate,
};
