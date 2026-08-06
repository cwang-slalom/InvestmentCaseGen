import { NextRequest, NextResponse } from "next/server";

import { requireApiProjectAccess } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

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

  if (wantsJson(request)) {
    return NextResponse.json(
      { error: "Live model generation is required before donor follow-up edits can be applied." },
      { status: 503 },
    );
  }

  return redirectWithParam({
    request,
    projectId,
    opportunityId,
    draftId,
    key: "followup",
    value: "model-required",
  });
}
