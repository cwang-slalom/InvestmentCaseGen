import path from "node:path";

import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";

import type {
  DocumentHeading,
  DocumentParserMetadata,
  DocumentWarning,
} from "@/domain";

import { DOCUMENT_LIMITS } from "./limits";
import {
  DocumentParseError,
  type DocumentParser,
  type DocumentParserInput,
  type ParsedDocument,
  type ParsedDocumentSegment,
} from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function textFromSegments(segments: ParsedDocumentSegment[]) {
  return normalizeExtractedText(
    segments.map((segment) => segment.text).join("\n\n"),
  );
}

function isLikelyHeading(line: string) {
  const trimmed = line.trim();
  if (trimmed.length < 4 || trimmed.length > 120) {
    return false;
  }

  if (/^#{1,4}\s+\S/.test(trimmed)) {
    return true;
  }

  if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(trimmed)) {
    return true;
  }

  if (trimmed.endsWith(":") && trimmed.split(/\s+/).length <= 12) {
    return true;
  }

  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function headingLevel(line: string) {
  const markdown = line.match(/^(#{1,4})\s+/);
  if (markdown) {
    return markdown[1]?.length;
  }

  const numbered = line.match(/^(\d+(?:\.\d+)*)\.?\s+/);
  if (numbered) {
    return numbered[1]?.split(".").length;
  }

  return undefined;
}

function extractHeadings(segments: ParsedDocumentSegment[]): DocumentHeading[] {
  const headings: DocumentHeading[] = [];

  for (const segment of segments) {
    for (const line of segment.text.split("\n")) {
      const trimmed = line.trim().replace(/^#{1,4}\s+/, "");
      if (!isLikelyHeading(line)) {
        continue;
      }

      headings.push({
        text: trimmed.replace(/:$/, ""),
        level: headingLevel(line),
        pageNumber: segment.pageNumber,
        slideNumber: segment.slideNumber,
      });

      if (headings.length >= 100) {
        return headings;
      }
    }
  }

  return headings;
}

function attachSectionHeadings(
  segments: ParsedDocumentSegment[],
  headings = extractHeadings(segments),
) {
  return segments.map((segment) => {
    const directHeading = headings.find(
      (heading) =>
        heading.pageNumber === segment.pageNumber &&
        heading.slideNumber === segment.slideNumber,
    );

    return {
      ...segment,
      sectionHeading:
        segment.sectionHeading ?? directHeading?.text ?? undefined,
    };
  });
}

function createMetadata({
  parserName,
  segments,
  pageCount,
  slideCount,
  text,
}: {
  parserName: string;
  segments: ParsedDocumentSegment[];
  pageCount?: number;
  slideCount?: number;
  text: string;
}): DocumentParserMetadata {
  return {
    parserName,
    pageCount,
    slideCount,
    wordCount: countWords(text),
    characterCount: text.length,
    textDensity:
      pageCount || slideCount
        ? text.length / Math.max(pageCount ?? slideCount ?? 1, 1)
        : undefined,
    headings: extractHeadings(segments),
  };
}

function ensureUsableText(text: string) {
  if (text.length > DOCUMENT_LIMITS.maxTextCharacters) {
    throw new DocumentParseError(
      "text_over_direct_processing_limit",
      `Extracted text exceeds the ${DOCUMENT_LIMITS.maxTextCharacters.toLocaleString()} character MVP limit. Split the source into smaller documents.`,
    );
  }

  if (text.length < DOCUMENT_LIMITS.minExtractedTextCharacters) {
    throw new DocumentParseError(
      "empty_or_near_empty_text",
      "The document did not contain enough extractable text to process.",
    );
  }
}

function createParsedDocument({
  parserName,
  segments,
  warnings,
  pageCount,
  slideCount,
}: {
  parserName: string;
  segments: ParsedDocumentSegment[];
  warnings: DocumentWarning[];
  pageCount?: number;
  slideCount?: number;
}): ParsedDocument {
  const normalizedSegments = attachSectionHeadings(
    segments
      .map((segment) => ({
        ...segment,
        text: normalizeExtractedText(segment.text),
      }))
      .filter((segment) => segment.text.length > 0),
  );
  const text = textFromSegments(normalizedSegments);

  ensureUsableText(text);

  return {
    text,
    warnings,
    metadata: createMetadata({
      parserName,
      segments: normalizedSegments,
      pageCount,
      slideCount,
      text,
    }),
    segments: normalizedSegments,
    pageCount,
    slideCount,
  };
}

function warning(code: string, message: string): DocumentWarning {
  return { code, message, blocking: false };
}

let pdfWorkerConfigured = false;

async function createPdfParse(input: DocumentParserInput) {
  const { PDFParse } = await import("pdf-parse");

  if (!pdfWorkerConfigured) {
    PDFParse.setWorker(
      path.join(
        process.cwd(),
        "node_modules",
        "pdf-parse",
        "dist",
        "worker",
        "pdf.worker.mjs",
      ),
    );
    pdfWorkerConfigured = true;
  }

  return new PDFParse({
    data: new Uint8Array(
      input.buffer.buffer,
      input.buffer.byteOffset,
      input.buffer.byteLength,
    ),
  });
}

export class TxtDocumentParser implements DocumentParser {
  readonly format = "txt" as const;

  async parse(input: DocumentParserInput): Promise<ParsedDocument> {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      input.buffer,
    );

    return createParsedDocument({
      parserName: "txt",
      segments: [{ text }],
      warnings: [],
    });
  }
}

export class PdfDocumentParser implements DocumentParser {
  readonly format = "pdf" as const;

  async parse(input: DocumentParserInput): Promise<ParsedDocument> {
    const parser = await createPdfParse(input);

    try {
      const textResult = await parser.getText({
        lineEnforce: true,
        pageJoiner: "",
      });
      const pageCount = textResult.total;

      if (pageCount > DOCUMENT_LIMITS.maxPdfPages) {
        throw new DocumentParseError(
          "pdf_page_count_over_limit",
          `PDF has ${pageCount} pages, above the ${DOCUMENT_LIMITS.maxPdfPages} page MVP limit.`,
        );
      }

      const segments = textResult.pages.map((page) => ({
        text: page.text,
        pageNumber: page.num,
      }));

      return createParsedDocument({
        parserName: "pdf-parse",
        segments,
        pageCount,
        warnings: [
          warning(
            "pdf_visuals_not_interpreted",
            "PDF charts, diagrams, images, and layout semantics were not interpreted.",
          ),
        ],
      });
    } finally {
      await parser.destroy();
    }
  }
}

export class DocxDocumentParser implements DocumentParser {
  readonly format = "docx" as const;

  async parse(input: DocumentParserInput): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    const warnings = result.messages.map((message) =>
      warning(
        message.type === "warning"
          ? "docx_parser_warning"
          : "docx_parser_error",
        message.message,
      ),
    );

    warnings.push(
      warning(
        "docx_page_count_unavailable",
        "DOCX page count is not available from text extraction and could not be enforced.",
      ),
      warning(
        "docx_tables_may_be_degraded",
        "DOCX tables may be represented as plain text without row or column semantics.",
      ),
    );

    return createParsedDocument({
      parserName: "mammoth",
      segments: [{ text: result.value }],
      warnings,
    });
  }
}

function collectTextNodes(value: unknown, output: string[] = []) {
  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextNodes(item, output);
    }
    return output;
  }

  if (!value || typeof value !== "object") {
    return output;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "a:t") {
      collectTextNodes(nestedValue, output);
      continue;
    }

    if (key.startsWith("@_")) {
      continue;
    }

    collectTextNodes(nestedValue, output);
  }

  return output;
}

function slideNumberFromPath(pathname: string) {
  const match = pathname.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

export class PptxDocumentParser implements DocumentParser {
  readonly format = "pptx" as const;

  async parse(input: DocumentParserInput): Promise<ParsedDocument> {
    const archive = unzipSync(new Uint8Array(input.buffer));
    const slidePaths = Object.keys(archive)
      .filter((pathname) => /^ppt\/slides\/slide\d+\.xml$/.test(pathname))
      .sort((a, b) => slideNumberFromPath(a) - slideNumberFromPath(b));

    if (slidePaths.length === 0) {
      throw new DocumentParseError(
        "pptx_no_slides",
        "The PPTX did not contain readable slide XML.",
      );
    }

    if (slidePaths.length > DOCUMENT_LIMITS.maxPptxSlides) {
      throw new DocumentParseError(
        "pptx_slide_count_over_limit",
        `PPTX has ${slidePaths.length} slides, above the ${DOCUMENT_LIMITS.maxPptxSlides} slide MVP limit.`,
      );
    }

    const segments = slidePaths.map((slidePath) => {
      const xml = strFromU8(archive[slidePath] ?? new Uint8Array());
      const parsed = xmlParser.parse(xml);
      const lines = collectTextNodes(parsed)
        .map((part) => part.trim())
        .filter(Boolean);

      return {
        text: lines.join("\n"),
        slideNumber: slideNumberFromPath(slidePath),
        sectionHeading: lines[0],
      };
    });

    return createParsedDocument({
      parserName: "pptx-xml",
      segments,
      slideCount: slidePaths.length,
      warnings: [
        warning(
          "pptx_visuals_not_interpreted",
          "PPTX visuals, charts, diagrams, and speaker notes were not interpreted.",
        ),
      ],
    });
  }
}
