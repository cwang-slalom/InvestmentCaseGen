import { NextRequest, NextResponse } from "next/server";

import { requireApiProjectAccess } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const storage = getStorage();
  const auth = await requireApiProjectAccess({
    request: _request,
    projectId,
    permission: "view",
    storage,
  });

  if (auth.response) {
    return auth.response;
  }

  const opportunities = await storage.listOpportunityRecords(projectId);
  return NextResponse.json({ opportunities });
}
