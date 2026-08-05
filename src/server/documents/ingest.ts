import { createHash, randomUUID } from "node:crypto";

import { type DocumentWarning, DocumentWarningSchema } from "@/domain";
import {
  saveUploadedFile,
  sanitizeFilename,
  UploadedFileStorageError,
} from "@/server/uploads/files";
import type { Storage } from "@/server/storage";

import { createSourceChunks } from "./chunking";
import { detectDocumentFormat } from "./detect-format";
import { DOCUMENT_LIMITS, formatBytes } from "./limits";
import { getDocumentParser } from "./registry";
import { DocumentParseError } from "./types";

export class DocumentUploadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "DocumentUploadError";
  }

  toWarning(): DocumentWarning {
    return DocumentWarningSchema.parse({
      code: this.code,
      message: this.message,
      blocking: true,
    });
  }
}

function validateUploadEnvelope(file: File) {
  if (file.size <= 0) {
    throw new DocumentUploadError(
      "empty_file",
      "Choose a non-empty source document.",
    );
  }

  if (file.size > DOCUMENT_LIMITS.maxFileSizeBytes) {
    throw new DocumentUploadError(
      "file_size_over_limit",
      `File size is ${formatBytes(file.size)}, above the ${formatBytes(DOCUMENT_LIMITS.maxFileSizeBytes)} MVP limit.`,
    );
  }
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export async function ingestUploadedDocument({
  projectId,
  file,
  storage,
}: {
  projectId: string;
  file: File;
  storage: Storage;
}) {
  validateUploadEnvelope(file);

  const format = detectDocumentFormat(
    file.name,
    file.type || "application/octet-stream",
  );
  if (!format) {
    throw new DocumentUploadError(
      "unsupported_file_type",
      "Supported source document types are PDF, DOCX, PPTX, TXT, and Markdown text.",
    );
  }

  const project = await storage.getProject(projectId);
  if (!project) {
    throw new DocumentUploadError(
      "project_not_found",
      "Project not found.",
      404,
    );
  }

  const documentId = randomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());
  let storagePath: string;

  try {
    storagePath = await saveUploadedFile({
      buffer,
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      projectId,
      documentId,
    });
  } catch (error) {
    if (error instanceof UploadedFileStorageError) {
      throw new DocumentUploadError(error.code, error.message, error.status);
    }

    throw error;
  }

  const document = await storage.createSourceDocument({
    id: documentId,
    projectId,
    filename: sanitizeFilename(file.name),
    mimeType: file.type || "application/octet-stream",
    fileExtension: format,
    sizeBytes: file.size,
    storagePath,
    parserType: format,
  });

  try {
    const parsed = await getDocumentParser(format).parse({
      buffer,
      filename: document.filename,
      mimeType: document.mimeType,
    });
    const chunks = createSourceChunks(document, parsed);
    await storage.replaceSourceChunks(document.id, chunks);
    const updatedDocument = await storage.updateSourceDocument(document.id, {
      status: "parsed",
      warnings: parsed.warnings,
      parserMetadata: parsed.metadata,
      textHash: hashText(parsed.text),
      characterCount: parsed.text.length,
    });

    return {
      document: updatedDocument,
      chunkCount: chunks.length,
    };
  } catch (error) {
    if (!(error instanceof DocumentParseError)) {
      const errorName = error instanceof Error ? error.name : typeof error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Document ingestion failed after upload: ${errorName}: ${errorMessage}`,
      );
    }

    const parseError =
      error instanceof DocumentParseError
        ? error
        : new DocumentParseError(
            "parse_failed",
            "The document could not be parsed.",
          );

    const failedDocument = await storage.updateSourceDocument(document.id, {
      status: "failed",
      warnings: [parseError.toWarning()],
      errorMessage: parseError.message,
    });

    return {
      document: failedDocument,
      chunkCount: 0,
    };
  }
}
