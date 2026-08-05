import { NextRequest, NextResponse } from "next/server";

import { requireApiProjectAccess } from "@/server/auth";
import { getConfiguredModelProvider } from "@/server/model-provider";
import { extractOpportunitiesForProject } from "@/server/opportunities";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
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

  const opportunities = await extractOpportunitiesForProject({
    projectId,
    storage,
    provider: getConfiguredModelProvider(),
  });

  if (wantsJson(request)) {
    return NextResponse.json({ opportunities }, { status: 201 });
  }

  const url = new URL(`/projects/${projectId}/opportunities`, request.url);
  url.searchParams.set("extracted", String(opportunities.length));

  return NextResponse.redirect(url, { status: 303 });
}
