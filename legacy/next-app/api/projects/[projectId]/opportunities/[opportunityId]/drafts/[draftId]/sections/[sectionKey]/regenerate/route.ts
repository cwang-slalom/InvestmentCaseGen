import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireApiProjectAccess } from "@/server/auth";
import {
  loadOpportunityCitations,
  regenerateDraftSection,
} from "@/server/drafts";
import { loadPrompt } from "@/server/prompts";
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

  const prompt = await loadPrompt("strengthen-narrative");
  const citations = await loadOpportunityCitations(
    storage,
    record.sourceDocumentIds,
  );
  const draft = regenerateDraftSection(
    draftRecord.draft,
    record,
    citations,
    sectionKey,
  );
  const generationRun = await storage.createGenerationRun({
    id: randomUUID(),
    projectId,
    opportunityId: record.opportunity.id,
    runType: "regenerate_draft_section",
    promptName: prompt.name,
    promptVersion: prompt.version,
    modelProvider: "deterministic",
    modelName: "source-grounded-section-regenerator-v1",
    inputChunkIds: citations
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
    return NextResponse.json({ draft: updated });
  }

  const url = new URL(
    `/projects/${projectId}/opportunities/${opportunityId}/drafts/${draftId}`,
    request.url,
  );
  url.searchParams.set("regenerated", sectionKey);

  return NextResponse.redirect(url, { status: 303 });
}
