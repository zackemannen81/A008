import { engineHeaders } from "../session/engine-access.js";

export interface GeneratedImage {
  readonly locator: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly mediaType: string;
  readonly filename: string;
}

export function generatedImageSrc(image: GeneratedImage): string {
  return `/v1/blobs/${image.sha256}/${encodeURIComponent(image.filename)}`;
}

export async function generateImage(
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeneratedImage> {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    throw new Error("Describe the image to generate.");
  }
  const response = await fetchImpl("/v1/images", {
    method: "POST",
    headers: {
      ...engineHeaders(),
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ prompt: trimmed }),
  });
  if (!response.ok) {
    let message = `Image generation failed (${response.status}).`;
    try {
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof (payload as { message: unknown }).message === "string"
      ) {
        message = (payload as { message: string }).message;
      }
    } catch {
      /* keep status message */
    }
    throw new Error(message);
  }
  return (await response.json()) as GeneratedImage;
}
