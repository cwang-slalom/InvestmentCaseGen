import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiProjectAccess } from "@/server/auth";
import { applyDonorFollowUpToDraft } from "@/server/drafts";
import { loadPrompt } from "@/server/prompts";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

const DonorFollowUpRequestSchema = z.object({
  donorName: z.string().trim().max(120).optional(),
  message: z.string().trim().min(1).max(4000),
});

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

function draftUrl({
  request,
  projectId,
  opportunityId,
  draftId,
}: {
  request: NextRequest;
  projectId: string;
  opportunityId: string;
  draftId: string;
}) {
  return new URL(
    `/projects/${projectId}/opportunities/${opportunityId}/drafts/${draftId}`,
    request.url,
  );
}

function redirectWithParam({
  request,
  projectId,
  opportunityId,
  draftId,
  key,
  value,
}: {
  request: NextRequest;
  projectId: string;
  opportunityId: string;
  draftId: string;
  key: string;
  value: string;
}) {
  const url = draftUrl({ request, projectId, opportunityId, draftId });
  url.searchParams.set(key, value);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      projectId: string;
      opportunityId: string;
      draftId: string;
    }>;
  },
) {
  const { projectId, opportunityId, draftId } = await context.params;
  const storage = getStorage();
  const auth = await requireApiProjectAccess({
    request,
    projectId,
    permission: "edit",
    storage,
  });

  if (auth.response) {
    return auth.response;
  }

  const draftRecord = await storage.getDraftRecord(projectId, draftId);

  if (!draftRecord || draftRecord.opportunityRecordId !== opportunityId) {
    if (wantsJson(request)) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    return NextResponse.redirect(
      new URL(
        `/projects/${projectId}/opportunities/${opportunityId}`,
        request.url,
      ),
      { status: 303 },
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
    const input = DonorFollowUpRequestSchema.parse(body);
    const draft = applyDonorFollowUpToDraft({
      draft: draftRecord.draft,
      message: input.message,
      donorName: input.donorName,
    });
    const prompt = await loadPrompt("apply-donor-followup");
    const generationRun = await storage.createGenerationRun({
      id: randomUUID(),
      projectId,
      opportunityId: draftRecord.opportunityId,
      runType: "apply_donor_followup",
      promptName: prompt.name,
      promptVersion: prompt.version,
      modelProvider: "deterministic",
      modelName: "source-grounded-followup-updater-v1",
      inputChunkIds: draft.citations
        .map((citation) => citation.chunkId)
        .filter((chunkId): chunkId is string => Boolean(chunkId)),
      validationResult: draft.validation,
      status: "completed",
      storedPayloadMode: "validated_outputs_only",
    });
    const updated = await storage.updateDraftRecord(projectId, draftId, {
      draft,
      investorSegment: draft.investorSegment,
      generationRunId: generationRun.id,
    });

    if (wantsJson(request)) {
      return NextResponse.json({ draft: updated }, { status: 200 });
    }

    return redirectWithParam({
      request,
      projectId,
      opportunityId,
      draftId,
      key: "followup",
      value: "applied",
    });
  } catch (error) {
    if (wantsJson(request)) {
      return NextResponse.json(
        {
          error:
            error instanceof z.ZodError
              ? "Enter a donor follow-up message under 4,000 characters."
              : "The donor follow-up could not be applied.",
        },
        { status: error instanceof z.ZodError ? 400 : 500 },
      );
    }

    return redirectWithParam({
      request,
      projectId,
      opportunityId,
      draftId,
      key: "followupError",
      value:
        error instanceof z.ZodError
          ? "Enter a donor follow-up message under 4,000 characters."
          : "The donor follow-up could not be applied.",
    });
  }
}
