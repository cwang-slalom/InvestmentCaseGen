import { NextRequest, NextResponse } from "next/server";

import { DocumentUploadResultSchema } from "@/domain";
import {
  DocumentUploadError,
  ingestUploadedDocument,
} from "@/server/documents";
import { requireApiProjectAccess } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

function wantsJson(request: NextRequest, formData?: FormData) {
  return (
    request.headers.get("accept")?.includes("application/json") ||
    formData?.get("responseMode") === "json"
  );
}

function redirectToDocuments(
  request: NextRequest,
  projectId: string,
  searchParams: Record<string, string>,
) {
  const url = new URL(`/projects/${projectId}/documents`, request.url);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url, { status: 303 });
}

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

  const documents = await storage.listSourceDocuments(projectId);
  return NextResponse.json({ documents });
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

  const formData = await request.formData();
  const uploadedFile = formData.get("file");

  if (!(uploadedFile instanceof File)) {
    const error = new DocumentUploadError(
      "missing_file",
      "Choose a source document to upload.",
    );

    if (!wantsJson(request, formData)) {
      return redirectToDocuments(request, projectId, {
        status: "error",
        message: error.message,
      });
    }

    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  try {
    const result = DocumentUploadResultSchema.parse(
      await ingestUploadedDocument({
        projectId,
        file: uploadedFile,
        storage,
      }),
    );

    if (!wantsJson(request, formData)) {
      return redirectToDocuments(request, projectId, {
        status: result.document.status,
        documentId: result.document.id,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const uploadError =
      error instanceof DocumentUploadError
        ? error
        : new DocumentUploadError(
            "upload_failed",
            "The source document could not be uploaded.",
            500,
          );

    if (!wantsJson(request, formData)) {
      return redirectToDocuments(request, projectId, {
        status: "error",
        message: uploadError.message,
      });
    }

    return NextResponse.json(
      {
        error: uploadError.message,
        code: uploadError.code,
      },
      { status: uploadError.status },
    );
  }
}
