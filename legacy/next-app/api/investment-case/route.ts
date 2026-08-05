import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  AudienceTailoringSchema,
  InvestorSegmentSchema,
  OutputTypeSchema,
  ProspectusBuilderSchema,
} from "@/domain";
import { requireApiUser } from "@/server/auth";
import {
  DocumentUploadError,
  ingestUploadedDocument,
} from "@/server/documents";
import { createDraftForOpportunity } from "@/server/drafts";
import { getConfiguredModelProvider } from "@/server/model-provider";
import { extractOpportunitiesForProject } from "@/server/opportunities";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

const GenerateInvestmentCaseSchema = z.object({
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(500).optional(),
  outputTypes: z
    .array(OutputTypeSchema)
    .min(1)
    .max(8)
    .default(["investment_prospectus"]),
  investorSegment: InvestorSegmentSchema.default(
    "us_foundation_program_officer",
  ),
  audienceTailoring: AudienceTailoringSchema,
  prospectusBuilder: ProspectusBuilderSchema,
  strengthenNarrative: z.boolean().default(true),
  externalWebSearch: z.boolean().default(false),
});

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

function optionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function nameFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension.replace(/[_-]+/g, " ").trim();
  return normalized || "Donor investment case";
}

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL("/create", request.url);
  url.searchParams.set("status", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}

function errorResponse(request: NextRequest, message: string, status = 400) {
  if (wantsJson(request)) {
    return NextResponse.json({ error: message }, { status });
  }

  return redirectWithError(request, message);
}

function parseGenerationRequest(formData: FormData) {
  const requestedOutputTypes = formData
    .getAll("outputTypes")
    .map(optionalText)
    .filter((value): value is string => Boolean(value));
  const fallbackOutputType = optionalText(formData.get("outputType"));
  const outputTypes = Array.from(
    new Set(
      requestedOutputTypes.length > 0
        ? requestedOutputTypes
        : fallbackOutputType
          ? [fallbackOutputType]
          : undefined,
    ),
  );

  return GenerateInvestmentCaseSchema.parse({
    name: optionalText(formData.get("name")),
    description: optionalText(formData.get("description")),
    outputTypes,
    investorSegment: optionalText(formData.get("investorSegment")),
    audienceTailoring: {
      familiarity: optionalText(formData.get("audienceFamiliarity")),
      scale: optionalText(formData.get("audienceScale")),
      tone: optionalText(formData.get("narrativeTone")),
      customInstructions: optionalText(formData.get("tailoringNotes")),
    },
    prospectusBuilder: {
      variantLabel: optionalText(formData.get("variantLabel")),
      narrativeAngle: optionalText(formData.get("narrativeAngle")),
      intendedAudience: optionalText(formData.get("intendedAudience")),
      callToAction: optionalText(formData.get("callToAction")),
      positioningNotes: optionalText(formData.get("positioningNotes")),
    },
    strengthenNarrative: formBoolean(formData.get("strengthenNarrative")),
    externalWebSearch: formBoolean(formData.get("externalWebSearch")),
  });
}

function uploadFailureMessage(
  result: Awaited<ReturnType<typeof ingestUploadedDocument>>,
) {
  return (
    result.document.errorMessage ??
    result.document.warnings.find((warning) => warning.blocking)?.message ??
    result.document.warnings[0]?.message ??
    "The uploaded document could not be parsed into source text."
  );
}

export async function POST(request: NextRequest) {
  const storage = getStorage();
  const auth = await requireApiUser(request, storage);

  if (!auth.user) {
    return auth.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      request,
      "Upload a source document to generate a case.",
    );
  }

  const uploadedFile = formData.get("file");

  if (!(uploadedFile instanceof File)) {
    return errorResponse(request, "Choose a source document to upload.");
  }

  try {
    const input = parseGenerationRequest(formData);
    const provider = getConfiguredModelProvider();
    const project = await storage.createProject({
      name: input.name ?? nameFromFilename(uploadedFile.name),
      description:
        input.description ??
        "Generated from original uploaded foundation material.",
      ownerUserId: auth.user.id,
    });
    const uploadResult = await ingestUploadedDocument({
      projectId: project.id,
      file: uploadedFile,
      storage,
    });

    if (
      uploadResult.document.status !== "parsed" ||
      uploadResult.chunkCount === 0
    ) {
      return errorResponse(request, uploadFailureMessage(uploadResult), 422);
    }

    const opportunities = await extractOpportunitiesForProject({
      projectId: project.id,
      storage,
      provider,
    });
    const opportunity = opportunities[0];

    if (!opportunity) {
      return errorResponse(
        request,
        "No investment case candidate was detected. Add source text with a clearer problem, intervention, funding, scale, or outcome signal.",
        422,
      );
    }

    const drafts = [];

    for (const outputType of input.outputTypes) {
      drafts.push(
        await createDraftForOpportunity({
          storage,
          record: opportunity,
          outputType,
          investorSegment: input.investorSegment,
          audienceTailoring: input.audienceTailoring,
          prospectusBuilder: input.prospectusBuilder,
          strengthenNarrative: input.strengthenNarrative,
          externalWebSearch: input.externalWebSearch,
          provider,
        }),
      );
    }
    const primaryDraft = drafts[0];

    if (wantsJson(request)) {
      return NextResponse.json(
        {
          project,
          opportunity,
          draft: primaryDraft,
          drafts,
        },
        { status: 201 },
      );
    }

    if (drafts.length === 1 && primaryDraft) {
      return NextResponse.redirect(
        new URL(
          `/projects/${project.id}/opportunities/${opportunity.id}/drafts/${primaryDraft.id}`,
          request.url,
        ),
        { status: 303 },
      );
    }

    const url = new URL("/", request.url);
    url.searchParams.set("projectId", project.id);
    url.searchParams.set("status", "success");
    url.searchParams.set(
      "message",
      `Generated ${drafts.length} draft outputs for review.`,
    );
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        request,
        "Choose valid output types, donor audience, audience tailoring, and tone.",
      );
    }

    if (error instanceof DocumentUploadError) {
      return errorResponse(request, error.message, error.status);
    }

    return errorResponse(
      request,
      "The investment case could not be generated from this document.",
      500,
    );
  }
}
