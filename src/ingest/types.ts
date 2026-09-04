import type { ProvenanceRelation } from "../memory/knowledge/evidence-types.js";
import type { ContentKind } from "../memory/knowledge/types.js";

export const TEXT_PLAIN = "text/plain";
export const TEXT_MARKDOWN = "text/markdown";
export const IMAGE_PNG = "image/png";
export const IMAGE_JPEG = "image/jpeg";
export const IMAGE_WEBP = "image/webp";
export const IMAGE_GIF = "image/gif";
export const APPLICATION_PDF = "application/pdf";
export const APPLICATION_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const APPLICATION_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const APPLICATION_PPTX =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const APPLICATION_ZIP = "application/zip";
export const APPLICATION_OCTET_STREAM = "application/octet-stream";

export interface SourceExtractionInput {
  readonly bytes: Uint8Array;
  /** Resolved by sniffing the bytes. A declared extension never decides this. */
  readonly mediaType: string;
  /** Stable content-addressed locator of the stored original. */
  readonly locator: string;
  /** Sanitised original filename, advisory only. */
  readonly filename?: string;
  /** Speaker to record when the text is literally the source's own content. */
  readonly uploadedBy: string;
  readonly signal?: AbortSignal;
}

/**
 * Text plus the provenance the extractor is entitled to claim.
 *
 * Each extractor sets `speaker` and `relation` itself, because only the
 * extractor knows whether the text was taken *from* the artifact or written
 * *about* it. Text lifted out of a document `appears_in` that document; a
 * model's description of an image is `derived_from` the image and is spoken by
 * the model, not by whoever uploaded the file.
 */
export interface ExtractedSource {
  readonly content: string;
  readonly speaker: string;
  readonly relation: ProvenanceRelation;
  readonly contentKind?: ContentKind;
}

export interface SourceExtractor {
  readonly id: string;
  supports(mediaType: string): boolean;
  extract(input: SourceExtractionInput): Promise<ExtractedSource>;
}

export interface ImageDescriptionInput {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly signal?: AbortSignal;
}

export interface ImageDescription {
  readonly description: string;
  /** Recorded as the utterance speaker, so the account is attributable. */
  readonly model: string;
}

/**
 * Turns image bytes into words.
 *
 * Deliberately not a `ChatMessage`. `ChatMessage.content` is a `string` and
 * stays one: widening it for this one ingest path would ripple through
 * `ChatSession`, `MemoryAwareChatSession`, the semantic JSON generator, every
 * budget measurer, ACP and the CLI. See ADR 0020 D6.
 */
export interface ImageDescriber {
  describe(input: ImageDescriptionInput): Promise<ImageDescription>;
}
