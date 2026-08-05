import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireApiProjectAccess } from "@/server/auth";
import { draftToDocxBuffer } from "@/server/drafts";
import { loadPrompt } from "@/server/prompts";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

function filenameSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function GET(
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
    permission: "view",
    storage,
  });

  if (auth.response) {
    return auth.response;
  }

  const draftRecord = await storage.getDraftRecord(projectId, draftId);

  if (!draftRecord || draftRecord.opportunityRecordId !== opportunityId) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }

  const prompt = await loadPrompt(
    draftRecord.outputType === "executive_investment_case"
      ? "generate-investment-case"
      : "generate-opportunity-spotlight",
  );
  const buffer = draftToDocxBuffer(draftRecord.draft);
  await storage.createGenerationRun({
    id: randomUUID(),
    projectId,
    opportunityId: draftRecord.opportunityId,
    runType: "export_docx",
    promptName: prompt.name,
    promptVersion: prompt.version,
    modelProvider: "deterministic",
    modelName: "minimal-docx-exporter-v1",
    inputChunkIds: [],
    validationResult: draftRecord.draft.validation,
    status: "completed",
    storedPayloadMode: "validated_outputs_only",
  });

  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${
        filenameSafe(draftRecord.draft.title) || "investment-case"
      }.docx"`,
      "content-length": String(buffer.byteLength),
    },
  });
}
