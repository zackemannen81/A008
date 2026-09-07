import { ChatError } from "../../core/errors.js";

export const NVIDIA_IMAGE_GENERATE_URL =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell";
export const DEFAULT_IMAGE_MODEL = "black-forest-labs/flux.1-schnell";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface NvidiaImageRequest {
  readonly prompt: string;
  readonly width?: number;
  readonly height?: number;
  readonly seed?: number;
  readonly steps?: number;
}

export interface NvidiaImageResult {
  readonly bytes: Buffer;
  readonly mediaType: "image/png" | "image/jpeg";
}

export interface NvidiaImageTransportOptions {
  readonly apiKey: string;
  readonly endpoint?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64(value: string): Buffer {
  const trimmed = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.length === 0) {
    throw new ChatError("provider", "Image response contained empty image data.");
  }
  return bytes;
}

function mediaTypeOf(bytes: Buffer): "image/png" | "image/jpeg" {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return "image/png";
}

/** Reads NVIDIA genai `artifacts` or OpenAI-compatible `data[].b64_json`. */
export function parseNvidiaImagePayload(value: unknown): NvidiaImageResult {
  if (!isRecord(value)) {
    throw new ChatError("provider", "Image response was not a JSON object.");
  }
  const artifacts = value.artifacts;
  if (Array.isArray(artifacts) && artifacts.length > 0 && isRecord(artifacts[0])) {
    const encoded = artifacts[0].base64;
    if (typeof encoded !== "string" || encoded.trim().length === 0) {
      throw new ChatError("provider", "Image artifact was missing base64 data.");
    }
    const bytes = decodeBase64(encoded);
    return { bytes, mediaType: mediaTypeOf(bytes) };
  }
  const data = value.data;
  if (Array.isArray(data) && data.length > 0 && isRecord(data[0])) {
    const encoded = data[0].b64_json;
    if (typeof encoded !== "string" || encoded.trim().length === 0) {
      throw new ChatError("provider", "Image data was missing b64_json.");
    }
    const bytes = decodeBase64(encoded);
    return { bytes, mediaType: mediaTypeOf(bytes) };
  }
  if (typeof value.image === "string" && value.image.trim().length > 0) {
    const bytes = decodeBase64(value.image);
    return { bytes, mediaType: mediaTypeOf(bytes) };
  }
  throw new ChatError("provider", "Image response did not include image bytes.");
}

export class NvidiaImageTransport {
  readonly #apiKey: string;
  readonly #endpoint: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(options: NvidiaImageTransportOptions) {
    const apiKey = options.apiKey.trim();
    if (apiKey.length === 0) {
      throw new ChatError(
        "configuration",
        "NVIDIA_API_KEY is required for image generation.",
      );
    }
    this.#apiKey = apiKey;
    this.#endpoint = options.endpoint?.trim() || NVIDIA_IMAGE_GENERATE_URL;
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 120_000;
  }

  async generate(request: NvidiaImageRequest): Promise<NvidiaImageResult> {
    const prompt = request.prompt.trim();
    if (prompt.length === 0) {
      throw new ChatError("configuration", "Image prompt must not be empty.");
    }
    const width = request.width ?? 1024;
    const height = request.height ?? 1024;
    if (![width, height].every((n) => Number.isSafeInteger(n) && n >= 64 && n <= 2048)) {
      throw new ChatError("configuration", "Image width and height must be whole numbers from 64 to 2048.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          width,
          height,
          seed: request.seed ?? 0,
          steps: request.steps ?? 4,
        }),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new ChatError(
          "provider",
          `Image generation failed (${response.status}).`,
        );
      }
      let payload: unknown;
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        throw new ChatError("provider", "Image generation returned non-JSON.");
      }
      return parseNvidiaImagePayload(payload);
    } catch (error) {
      if (error instanceof ChatError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ChatError("timeout", "Image generation timed out.");
      }
      throw new ChatError("network", "Failed to reach the image generation endpoint.");
    } finally {
      clearTimeout(timer);
    }
  }
}
