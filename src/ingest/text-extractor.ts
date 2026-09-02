import { decodeUtf8Strict } from "./media-type.js";
import {
  TEXT_MARKDOWN,
  TEXT_PLAIN,
  type ExtractedSource,
  type SourceExtractionInput,
  type SourceExtractor,
} from "./types.js";

const SUPPORTED = new Set([TEXT_PLAIN, TEXT_MARKDOWN]);

/**
 * Text sources, taken verbatim.
 *
 * The relation is `appears_in` because the extracted characters are literally
 * the ones in the stored file, and the speaker is whoever supplied it: no model
 * interpreted anything on this path.
 */
export class Utf8TextExtractor implements SourceExtractor {
  readonly id = "utf8-text";

  supports(mediaType: string): boolean {
    return SUPPORTED.has(mediaType);
  }

  async extract(input: SourceExtractionInput): Promise<ExtractedSource> {
    return {
      content: decodeUtf8Strict(input.bytes),
      speaker: input.uploadedBy,
      relation: "appears_in",
    };
  }
}
