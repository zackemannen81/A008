import { SourceIngestError } from "./errors.js";
import {
  IMAGE_GIF,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  type ExtractedSource,
  type ImageDescriber,
  type SourceExtractionInput,
  type SourceExtractor,
} from "./types.js";

const SUPPORTED = new Set([IMAGE_PNG, IMAGE_JPEG, IMAGE_WEBP, IMAGE_GIF]);

/**
 * Images, by way of a model's description.
 *
 * The provenance is the point of this class. No text appeared in the image, so
 * the relation is `derived_from`, and the account was written by the model, so
 * the model is the speaker. Recording the uploading user instead would attribute
 * a machine's guess to a person and let it through `user-assertion-v1` as if the
 * user had asserted it.
 */
export class DescribedImageExtractor implements SourceExtractor {
  readonly id = "image-description";
  readonly #describer: ImageDescriber;

  constructor(describer: ImageDescriber) {
    this.#describer = describer;
  }

  supports(mediaType: string): boolean {
    return SUPPORTED.has(mediaType);
  }

  async extract(input: SourceExtractionInput): Promise<ExtractedSource> {
    const described = await this.#describer.describe({
      bytes: input.bytes,
      mediaType: input.mediaType,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const description = described.description.trim();
    if (description.length === 0) {
      throw new SourceIngestError(
        "description_failed",
        "The image describer returned no description.",
        { mediaType: input.mediaType },
      );
    }
    const model = described.model.trim();
    if (model.length === 0) {
      // Without a model name there is nothing truthful to record as speaker,
      // and an unattributable description must not enter the evidence store.
      throw new SourceIngestError(
        "description_failed",
        "The image describer did not name the model that produced the description.",
        { mediaType: input.mediaType },
      );
    }
    return {
      content: description,
      speaker: model,
      relation: "derived_from",
    };
  }
}
