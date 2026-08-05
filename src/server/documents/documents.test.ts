import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";

import type { SourceDocument } from "@/domain";

import { createSourceChunks } from "./chunking";
import { detectDocumentFormat } from "./detect-format";
import { DOCUMENT_LIMITS } from "./limits";
import {
  PdfDocumentParser,
  PptxDocumentParser,
  TxtDocumentParser,
} from "./parsers";

const sourceDocument: SourceDocument = {
  id: "document-1",
  projectId: "project-1",
  filename: "source.txt",
  mimeType: "text/plain",
  fileExtension: "txt",
  sizeBytes: 200,
  storagePath: "data/uploads/project-1/source.txt",
  parserType: "txt",
  status: "uploaded",
  warnings: [],
  characterCount: 0,
  createdAt: new Date("2026-07-14T00:00:00.000Z"),
  updatedAt: new Date("2026-07-14T00:00:00.000Z"),
};

describe("document format detection", () => {
  it("detects supported formats by MIME type or extension", () => {
    expect(detectDocumentFormat("case.pdf", "application/pdf")).toBe("pdf");
    expect(
      detectDocumentFormat("slides.pptx", "application/octet-stream"),
    ).toBe("pptx");
    expect(detectDocumentFormat("notes.md", "application/octet-stream")).toBe(
      "txt",
    );
  });

  it("returns null for unsupported formats", () => {
    expect(detectDocumentFormat("image.png", "image/png")).toBeNull();
  });
});

describe("TXT parser", () => {
  it("normalizes extractable text", async () => {
    const parser = new TxtDocumentParser();
    const result = await parser.parse({
      buffer: Buffer.from(" Line one\r\nLine two with enough text. "),
      filename: "source.txt",
      mimeType: "text/plain",
    });

    expect(result.text).toBe("Line one\nLine two with enough text.");
    expect(result.metadata.parserName).toBe("txt");
    expect(result.metadata.wordCount).toBe(7);
    expect(result.segments).toHaveLength(1);
  });

  it("rejects empty text", async () => {
    const parser = new TxtDocumentParser();
    await expect(
      parser.parse({
        buffer: Buffer.from("  "),
        filename: "empty.txt",
        mimeType: "text/plain",
      }),
    ).rejects.toThrow(/enough extractable text/);
  });

  it("rejects text over the direct-processing limit", async () => {
    const parser = new TxtDocumentParser();
    await expect(
      parser.parse({
        buffer: Buffer.from("x".repeat(DOCUMENT_LIMITS.maxTextCharacters + 1)),
        filename: "large.txt",
        mimeType: "text/plain",
      }),
    ).rejects.toThrow(/MVP limit/);
  });
});

describe("PDF parser", () => {
  it("extracts text and metadata from text-layer PDFs", async () => {
    const fixture = readFileSync(
      "resources/reference-output-examples/maternal-newborn-health-spotlights.pdf",
    );
    const prefix = Buffer.from("not part of the pdf");
    const paddedBuffer = Buffer.concat([
      prefix,
      fixture,
      Buffer.from("also not part of the pdf"),
    ]);
    const pdfBuffer = paddedBuffer.subarray(
      prefix.length,
      prefix.length + fixture.length,
    );
    const parser = new PdfDocumentParser();
    const result = await parser.parse({
      buffer: pdfBuffer,
      filename: "maternal-newborn-health-spotlights.pdf",
      mimeType: "application/pdf",
    });

    expect(result.pageCount).toBe(1);
    expect(result.metadata.pageCount).toBe(1);
    expect(result.metadata.parserName).toBe("pdf-parse");
    expect(result.text).toContain("maternal newborn health spotlights");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "pdf_visuals_not_interpreted" }),
    );
  });
});

describe("source chunking", () => {
  it("creates citation-backed chunks", () => {
    const chunks = createSourceChunks(sourceDocument, {
      text: "Source heading\n\nThis source text is long enough to be represented as a citation-backed chunk.",
      warnings: [],
      metadata: {
        parserName: "txt",
        wordCount: 14,
        characterCount: 90,
        headings: [{ text: "Source heading" }],
      },
      segments: [
        {
          text: "Source heading\n\nThis source text is long enough to be represented as a citation-backed chunk.",
          sectionHeading: "Source heading",
        },
      ],
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.citation.sourceDocumentId).toBe(sourceDocument.id);
    expect(chunks[0]?.citation.filename).toBe(sourceDocument.filename);
    expect(chunks[0]?.citation.sectionHeading).toBe("Source heading");
    expect(chunks[0]?.metadata.wordCount).toBeGreaterThan(0);
    expect(chunks[0]?.citation.excerpt).toContain("citation-backed chunk");
  });
});

describe("PPTX parser", () => {
  it("extracts slide text and metadata from presentation XML", async () => {
    const archive = zipSync({
      "ppt/slides/slide1.xml": strToU8(`
        <p:sld xmlns:p="p" xmlns:a="a">
          <p:cSld><p:spTree><p:sp><p:txBody>
            <a:p><a:r><a:t>Investment opportunity</a:t></a:r></a:p>
            <a:p><a:r><a:t>Funding can scale a program for children.</a:t></a:r></a:p>
          </p:txBody></p:sp></p:spTree></p:cSld>
        </p:sld>
      `),
    });
    const parser = new PptxDocumentParser();
    const result = await parser.parse({
      buffer: Buffer.from(archive),
      filename: "slides.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    expect(result.slideCount).toBe(1);
    expect(result.metadata.slideCount).toBe(1);
    expect(result.segments[0]?.slideNumber).toBe(1);
    expect(result.text).toContain("Funding can scale");
  });
});
