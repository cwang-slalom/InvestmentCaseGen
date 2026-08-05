import type {
  DocumentFormat,
  DocumentParserMetadata,
  DocumentWarning,
} from "@/domain";

export type ParsedDocumentSegment = {
  text: string;
  pageNumber?: number;
  slideNumber?: number;
  sectionHeading?: string;
};

export type ParsedDocument = {
  text: string;
  warnings: DocumentWarning[];
  metadata: DocumentParserMetadata;
  segments: ParsedDocumentSegment[];
  pageCount?: number;
  slideCount?: number;
};

export type DocumentParserInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

export interface DocumentParser {
  readonly format: DocumentFormat;
  parse(input: DocumentParserInput): Promise<ParsedDocument>;
}

export class DocumentParseError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly blocking = true,
  ) {
    super(message);
    this.name = "DocumentParseError";
  }

  toWarning(): DocumentWarning {
    return {
      code: this.code,
      message: this.message,
      blocking: this.blocking,
    };
  }
}
