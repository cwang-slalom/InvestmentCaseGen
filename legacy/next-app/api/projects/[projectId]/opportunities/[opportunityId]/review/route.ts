import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { FieldStatusSchema } from "@/domain";
import { assessOpportunityInvestability } from "@/server/assessment";
import { requireApiProjectAccess } from "@/server/auth";
import { applyOpportunityReviewEdits } from "@/server/review";
import { getStorage } from "@/server/storage";
import { validateOpportunityCitations } from "@/server/validation";

export const runtime = "nodejs";

const editableFields = [
  "title",
  "summary",
  "problemStatement",
  "proposedIntervention",
  "whyNow",
  "investorRelevance",
] as const;

const ReviewRequestSchema = z.object(
  Object.fromEntries(
    editableFields.flatMap((field) => [
      [field, z.string().optional()],
      [`${field}Status`, FieldStatusSchema.optional()],
    ]),
  ),
);

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; opportunityId: string }> },
) {
  const { projectId, opportunityId } = await context.params;
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

  const record = await storage.getOpportunityRecord(projectId, opportunityId);

  if (!record) {
    if (wantsJson(request)) {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }

    return NextResponse.redirect(
      new URL(`/projects/${projectId}/opportunities`, request.url),
      { status: 303 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());
  const reviewInput = ReviewRequestSchema.parse(body);
  const { opportunity, title, reviewMetadata } = applyOpportunityReviewEdits(
    record,
    reviewInput,
  );
  const validation = validateOpportunityCitations(opportunity);
  const assessment = assessOpportunityInvestability(opportunity);
  const updated = await storage.updateOpportunityRecord(
    projectId,
    opportunityId,
    {
      title,
      opportunity,
      assessment,
      validation,
      reviewMetadata,
    },
  );

  if (wantsJson(request)) {
    return NextResponse.json({ opportunity: updated });
  }

  const url = new URL(
    `/projects/${projectId}/opportunities/${opportunityId}`,
    request.url,
  );
  url.searchParams.set("reviewed", "1");

  return NextResponse.redirect(url, { status: 303 });
}
