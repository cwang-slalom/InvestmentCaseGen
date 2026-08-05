import type { DocumentFormat } from "@/domain";

import {
  DocxDocumentParser,
  PdfDocumentParser,
  PptxDocumentParser,
  TxtDocumentParser,
} from "./parsers";
import type { DocumentParser } from "./types";

const parsers: Record<DocumentFormat, DocumentParser> = {
  pdf: new PdfDocumentParser(),
  docx: new DocxDocumentParser(),
  pptx: new PptxDocumentParser(),
  txt: new TxtDocumentParser(),
};

export function getDocumentParser(format: DocumentFormat) {
  return parsers[format];
}
