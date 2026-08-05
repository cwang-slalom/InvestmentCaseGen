import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  AudienceTailoringSchema,
  InvestorSegmentSchema,
  OutputTypeSchema,
  ProspectusBuilderSchema,
} from "@/domain";
import { requireApiProjectAccess } from "@/server/auth";
import { createDraftForOpportunity } from "@/server/drafts";
import { getConfiguredModelProvider } from "@/server/model-provider";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

const GenerateDraftRequestSchema = z.object({
  outputType: OutputTypeSchema,
  investorSegment: InvestorSegmentSchema.default("general_donor"),
  audienceTailoring: AudienceTailoringSchema,
  prospectusBuilder: ProspectusBuilderSchema,
  strengthenNarrative: z
    .union([
      z.literal("on"),
      z.literal("true"),
      z.literal("false"),
      z.literal(true),
      z.literal(false),
    ])
    .optional(),
  externalWebSearch: z
    .union([
      z.literal("on"),
      z.literal("true"),
      z.literal("false"),
      z.literal(true),
      z.literal(false),
    ])
    .optional(),
});

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

function formBoolean(value: unknown) {
  return value === "on" || value === "true" || value === true;
}

function normalizeBody(body: Record<string, unknown>) {
  const providedTailoring =
    body.audienceTailoring &&
    typeof body.audienceTailoring === "object" &&
    !Array.isArray(body.audienceTailoring)
      ? body.audienceTailoring
      : undefined;
  const providedBuilder =
    body.prospectusBuilder &&
    typeof body.prospectusBuilder === "object" &&
    !Array.isArray(body.prospectusBuilder)
      ? body.prospectusBuilder
      : undefined;

  return {
    ...body,
    audienceTailoring: providedTailoring ?? {
      familiarity: body.audienceFamiliarity,
      scale: body.audienceScale,
      tone: body.narrativeTone,
      customInstructions: body.tailoringNotes,
    },
    prospectusBuilder: providedBuilder ?? {
      variantLabel: body.variantLabel,
      narrativeAngle: body.narrativeAngle,
      intendedAudience: body.intendedAudience,
      callToAction: body.callToAction,
      positioningNotes: body.positioningNotes,
    },
  };
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
  const input = GenerateDraftRequestSchema.parse(normalizeBody(body));
  const draftRecord = await createDraftForOpportunity({
    storage,
    record,
    outputType: input.outputType,
    investorSegment: input.investorSegment,
    audienceTailoring: input.audienceTailoring,
    prospectusBuilder: input.prospectusBuilder,
    strengthenNarrative:
      input.strengthenNarrative === undefined
        ? true
        : formBoolean(input.strengthenNarrative),
    externalWebSearch: formBoolean(input.externalWebSearch),
    provider: getConfiguredModelProvider(),
  });

  if (wantsJson(request)) {
    return NextResponse.json({ draft: draftRecord }, { status: 201 });
  }

  return NextResponse.redirect(
    new URL(
      `/projects/${projectId}/opportunities/${opportunityId}/drafts/${draftRecord.id}`,
      request.url,
    ),
    { status: 303 },
  );
}
