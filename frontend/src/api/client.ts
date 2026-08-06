import type {
  AppConfig,
  AudienceProfile,
  ExtractionResult,
  ExtractedField,
  FieldValue,
  GenerationJobStatus,
  GenerationResult,
  GeneratedSection,
  GeneratedOutput,
  InformationNeeded,
  Opportunity,
  OutputType,
  Project,
  ReviewFinding,
  ReviewRole,
} from "../types";

type ApiErrorPayload = {
  detail?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data = {} as T & ApiErrorPayload;
  if (text) {
    try {
      data = JSON.parse(text) as T & ApiErrorPayload;
    } catch {
      const fallback = response.ok
        ? "Response was not valid JSON."
        : text || "Request could not be completed.";
      throw new ApiError(fallback, response.status);
    }
  }
  if (!response.ok) {
    throw new ApiError(data.detail || "Request could not be completed.", response.status);
  }
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parseJson<T>(await fetch(path, { headers: { accept: "application/json" } }));
}

export async function apiJson<T>(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
  options?: { signal?: AbortSignal },
): Promise<T> {
  return parseJson<T>(
    await fetch(path, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: options?.signal,
    }),
  );
}

async function apiBlob(path: string, method: "POST", body: unknown): Promise<Blob> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new ApiError(payload.detail || "Download could not be completed.", response.status);
  }
  return response.blob();
}

export const api = {
  config: () => apiGet<AppConfig>("/api/config"),
  projects: () => apiGet<Project[]>("/api/projects"),
  createProject: (name?: string) => apiJson<Project>("/api/projects", "POST", { name }),
  project: (projectId: string) => apiGet<Project>(`/api/projects/${projectId}`),
  projectExtraction: (projectId: string) => apiGet<ExtractionResult>(`/api/projects/${projectId}/extraction`),
  updateTask: (
    projectId: string,
    body: { selectedTaskId?: string | null; taskLabel?: string | null; customDescription?: string | null },
  ) => apiJson<Project>(`/api/projects/${projectId}/task`, "PUT", body),
  updateOpportunityAudience: (
    projectId: string,
    body: {
      sourceMode: "existing" | "new";
      opportunityId?: string | null;
      audienceId?: string | null;
      intendedOutcome?: string | null;
      suggestions: FieldValue[];
      selectedOutputs: OutputType[];
    },
  ) => apiJson<Project>(`/api/projects/${projectId}/opportunity-audience`, "PUT", body),
  updateExtractionReview: (
    projectId: string,
    body: { fields: ExtractedField[]; confirmed: boolean },
  ) => apiJson<Project>(`/api/projects/${projectId}/extraction-review`, "PUT", body),
  rerunExtraction: (projectId: string) =>
    apiJson<ExtractionResult>(`/api/projects/${projectId}/extraction/rerun`, "POST", {}),
  updateReviewSetup: (
    projectId: string,
    body: { approachFields: FieldValue[]; roles: ReviewRole[]; confirmed: boolean },
  ) => apiJson<Project>(`/api/projects/${projectId}/review-setup`, "PUT", body),
  opportunities: () => apiGet<Opportunity[]>("/api/opportunities"),
  audiences: () => apiGet<AudienceProfile[]>("/api/audiences"),
  extractText: (projectId: string, sourceLabel: string, text: string) =>
    apiJson<ExtractionResult>(`/api/sources/extract?projectId=${projectId}`, "POST", {
      sourceLabel,
      text,
    }),
  extractKnowledgeSource: (projectId: string, sourceLabel: string, knowledgeSourceId: string) =>
    apiJson<ExtractionResult>(`/api/sources/extract?projectId=${projectId}`, "POST", {
      sourceLabel,
      knowledgeSourceId,
    }),
  extractFile: async (projectId: string, file: File) =>
    parseJson<ExtractionResult>(
      await fetch(`/api/sources/extract?projectId=${projectId}&filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": file.type || "application/octet-stream" },
        body: file,
      }),
    ),
  generate: (projectId: string, simulateError: boolean, options?: { signal?: AbortSignal }) =>
    apiJson<GenerationJobStatus>(`/api/projects/${projectId}/generate`, "POST", { simulateError }, options),
  generationStatus: (projectId: string) => apiGet<GenerationJobStatus>(`/api/projects/${projectId}/generation-status`),
  generation: (generationId: string) => apiGet<GenerationResult>(`/api/generations/${generationId}`),
  exportDocx: (
    projectId: string,
    body: {
      output: GeneratedOutput;
      informationNeeded: InformationNeeded[];
      reviewFindings: ReviewFinding[];
      metadata: Record<string, string>;
    },
  ) => apiBlob(`/api/projects/${projectId}/exports/docx`, "POST", body),
  regenerateSection: (generationId: string, sectionId: string) =>
    apiJson<GeneratedSection>(`/api/generations/${generationId}/sections/${sectionId}/regenerate`, "POST", {}),
  updateFinding: (generationId: string, findingId: string, resolved: boolean) =>
    apiJson<GenerationResult>(`/api/generations/${generationId}/findings/${findingId}`, "PUT", { resolved }),
};
