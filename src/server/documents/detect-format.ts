import path from "node:path";

import { DocumentFormatSchema, type DocumentFormat } from "@/domain";

const mimeTypeToFormat: Record<string, DocumentFormat> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
};

const extensionToFormat: Record<string, DocumentFormat> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".pptx": "pptx",
  ".txt": "txt",
  ".md": "txt",
};

export function detectDocumentFormat(
  filename: string,
  mimeType: string,
): DocumentFormat | null {
  const fromMime = mimeTypeToFormat[mimeType.toLowerCase()];
  if (fromMime) {
    return fromMime;
  }

  const extension = path.extname(filename).toLowerCase();
  const fromExtension = extensionToFormat[extension];
  if (!fromExtension) {
    return null;
  }

  return DocumentFormatSchema.parse(fromExtension);
}
