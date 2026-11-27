import { createCanvas, Image } from "@napi-rs/canvas";
import { ChatError } from "../core/errors.js";
import { IMAGE_GIF, IMAGE_WEBP } from "../ingest/types.js";

const MAX_INLINE_IMAGE_BYTES = 1_000_000;
const INITIAL_MAX_EDGE = 1920;

/**
 * Model-only representation: keep the original evidence source untouched.
 * Oversized PNG/JPEG/WebP screenshots are reduced before they are copied into
 * every Responses request. GIFs remain unmodified to preserve animation.
 */
export function prepareVisionImage(
  source: Uint8Array,
  mediaType: string,
): { mediaType: string; bytes: Buffer } {
  const original = Buffer.from(source);
  if (original.length <= MAX_INLINE_IMAGE_BYTES || mediaType === IMAGE_GIF) {
    return { mediaType, bytes: original };
  }

  try {
    const image = new Image();
    image.src = original;
    if (!image.width || !image.height) {
      throw new Error("Image has no decodable dimensions.");
    }

    let maxEdge = INITIAL_MAX_EDGE;
    for (const quality of [80, 72, 62, 55]) {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      const encoded = canvas.toBuffer("image/webp", quality);
      if (encoded.length <= MAX_INLINE_IMAGE_BYTES) {
        return { mediaType: IMAGE_WEBP, bytes: encoded };
      }
      maxEdge = Math.round(maxEdge * 0.75);
    }
  } catch (error) {
    throw new ChatError(
      "configuration",
      "Could not optimize the large image for model context; original source is unchanged.",
      { cause: error },
    );
  }
  throw new ChatError(
    "configuration",
    "Image remains larger than the model's 1 MB inline-image allowance after optimization; original source is unchanged.",
  );
}
