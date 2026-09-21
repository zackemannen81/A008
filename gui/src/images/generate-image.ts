import {
  generateImage as generateImageFromClient,
  generatedImageLocatorSrc,
  generatedImageSrc,
} from "../../../packages/client/src/index.js";
import type { GeneratedImage } from "../../../packages/protocol/src/index.js";
export type { GeneratedImage } from "../../../packages/protocol/src/index.js";
export { generatedImageSrc, generatedImageLocatorSrc };
import { guiHttp } from "../client.js";

export async function generateImage(
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeneratedImage> {
  return generateImageFromClient(guiHttp(fetchImpl), prompt);
}
