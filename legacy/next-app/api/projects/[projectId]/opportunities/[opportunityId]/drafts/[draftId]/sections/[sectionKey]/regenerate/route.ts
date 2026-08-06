import { NextRequest, NextResponse } from "next/server";

import { requireApiProjectAccess } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      projectId: string;
      opportunityId: string;
      draftId: string;
      sectionKey: string;
    }>;
  },
) {
  const { projectId, opportunityId, draftId, sectionKey } =
    await context.params;
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

  const [record, draftRecord] = await Promise.all([
    storage.getOpportunityRecord(projectId, opportunityId),
    storage.getDraftRecord(projectId, draftId),
  ]);

  if (!record || !draftRecord) {
    if (wantsJson(request)) {
      return NextResponse.json(
        { error: "Opportunity or draft not found." },
        { status: 404 },
      );
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
      { error: "Live model generation is required before sections can be regenerated." },
      { status: 503 },
    );
  }

  const url = new URL(
    `/projects/${projectId}/opportunities/${opportunityId}/drafts/${draftId}`,
    request.url,
  );
  url.searchParams.set("regenerated", "model-required");

  return NextResponse.redirect(url, { status: 303 });
}
