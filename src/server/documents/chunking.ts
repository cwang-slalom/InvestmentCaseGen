import { randomUUID } from "node:crypto";

import type { SourceDocument } from "@/domain";
import type { CreateSourceChunkInput } from "@/server/storage";

import type { ParsedDocument, ParsedDocumentSegment } from "./types";

const CHUNK_SIZE = 4_000;
const CHUNK_OVERLAP = 300;
const EXCERPT_SIZE = 500;

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function getSegments(input: ParsedDocument | string): ParsedDocumentSegment[] {
  if (typeof input === "string") {
    return [{ text: input }];
  }

  return input.segments.length > 0 ? input.segments : [{ text: input.text }];
}

export function createSourceChunks(
  document: SourceDocument,
  parsedDocument: ParsedDocument | string,
): CreateSourceChunkInput[] {
  const chunks: CreateSourceChunkInput[] = [];
  const segments = getSegments(parsedDocument);
  let segmentStart = 0;

  for (const segment of segments) {
    let cursor = 0;

    while (cursor < segment.text.length) {
      const chunkStart = cursor;
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, segment.text.length);
      const chunkText = segment.text.slice(chunkStart, chunkEnd).trim();

      if (chunkText.length > 0) {
        const chunkId = randomUUID();
        chunks.push({
          id: chunkId,
          sourceDocumentId: document.id,
          chunkIndex: chunks.length,
          text: chunkText,
          charStart: segmentStart + chunkStart,
          charEnd: segmentStart + chunkEnd,
          citation: {
            id: `${chunkId}:citation`,
            sourceDocumentId: document.id,
            filename: document.filename,
            pageNumber: segment.pageNumber,
            slideNumber: segment.slideNumber,
            sectionHeading: segment.sectionHeading,
            chunkId,
            excerpt: chunkText.slice(0, EXCERPT_SIZE),
          },
          metadata: {
            pageNumber: segment.pageNumber,
            slideNumber: segment.slideNumber,
            sectionHeading: segment.sectionHeading,
            wordCount: countWords(chunkText),
          },
        });
      }

      if (chunkEnd >= segment.text.length) {
        break;
      }

      cursor = Math.max(chunkEnd - CHUNK_OVERLAP, chunkStart + 1);
    }

    segmentStart += segment.text.length + 2;
  }

  return chunks;
}
