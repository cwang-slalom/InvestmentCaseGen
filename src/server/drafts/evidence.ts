import type { Citation } from "@/domain";
import type { Storage } from "@/server/storage";

export async function loadOpportunityCitations(
  storage: Storage,
  sourceDocumentIds: string[],
): Promise<Citation[]> {
  const chunksByDocument = await Promise.all(
    sourceDocumentIds.map((documentId) => storage.listSourceChunks(documentId)),
  );
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const chunk of chunksByDocument.flat()) {
    if (seen.has(chunk.citation.id)) {
      continue;
    }
    seen.add(chunk.citation.id);
    citations.push(chunk.citation);
  }

  return citations;
}
