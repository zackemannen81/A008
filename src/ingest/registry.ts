import { SourceIngestError } from "./errors.js";
import type {
  ExtractedSource,
  SourceExtractionInput,
  SourceExtractor,
} from "./types.js";

/**
 * Picks the extractor for a sniffed media type.
 *
 * There is deliberately no fallback. A type nothing claims raises
 * `unsupported_media_type` naming the type, so an upload A008 cannot read is
 * reported as unreadable rather than stored as though it had been understood.
 */
export class SourceExtractorRegistry {
  readonly #extractors: readonly SourceExtractor[];

  constructor(extractors: readonly SourceExtractor[]) {
    this.#extractors = [...extractors];
  }

  extractorFor(mediaType: string): SourceExtractor | undefined {
    return this.#extractors.find((extractor) => extractor.supports(mediaType));
  }

  supports(mediaType: string): boolean {
    return this.extractorFor(mediaType) !== undefined;
  }

  async extract(input: SourceExtractionInput): Promise<ExtractedSource> {
    const extractor = this.extractorFor(input.mediaType);
    if (extractor === undefined) {
      throw new SourceIngestError(
        "unsupported_media_type",
        `No A008 extractor reads ${input.mediaType}.`,
        { mediaType: input.mediaType },
      );
    }
    return await extractor.extract(input);
  }
}
