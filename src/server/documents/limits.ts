export const DOCUMENT_LIMITS = {
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxTextCharacters: 250_000,
  maxPdfPages: 150,
  maxDocxPages: 150,
  maxPptxSlides: 150,
  minExtractedTextCharacters: 20,
} as const;

export function formatBytes(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}
