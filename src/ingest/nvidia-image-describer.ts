import { ChatError, isChatError } from "../core/errors.js";
import type { FetchLike } from "../providers/nvidia/nvidia-chat-transport.js";
import { NVIDIA_CHAT_COMPLETIONS_URL } from "../providers/nvidia/nvidia-chat-transport.js";
import { SourceIngestError } from "./errors.js";
import type {
  ImageDescriber,
  ImageDescription,
  ImageDescriptionInput,
} from "./types.js";

export const IMAGE_DESCRIPTION_INSTRUCTION =
  "Describe what this image contains, factually and without speculation. " +
  "Transcribe any text you can read verbatim. State only what is visible. " +
  "Do not guess at anything the image does not show.";

export interface NvidiaImageDescriberOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly endpoint?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
  readonly instruction?: string;
  readonly maxTokens?: number;
}

interface CompletionShape {
  readonly choices?: readonly {
    readonly message?: { readonly content?: unknown };
  }[];
}

/**
 * Describes an image through NVIDIA's OpenAI-compatible chat-completions API.
 *
 * This builds its own request payload rather than going through
 * `NvidiaChatTransport`, because `ChatRequest` carries `ChatMessage.content` as
 * a `string` and image input needs content blocks. Keeping that shape local to
 * this file is the whole point of ADR 0020 D6: the provider-neutral core stays
 * text-only, and exactly one ingest-side file knows about image payloads.
 *
 * The endpoint and fetch are injectable for the same reason they are on the
 * chat transport — every test in this repository runs against a fake, and no
 * live provider call is authorised.
 */
export class NvidiaImageDescriber implements ImageDescriber {
  readonly #apiKey: string;
  readonly #model: string;
  readonly #endpoint: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  readonly #instruction: string;
  readonly #maxTokens: number;

  constructor(options: NvidiaImageDescriberOptions) {
    const apiKey = options.apiKey.trim();
    if (apiKey.length === 0) {
      throw new ChatError(
        "configuration",
        "NVIDIA_API_KEY is required for image description.",
      );
    }
    const model = options.model.trim();
    if (model.length === 0) {
      throw new ChatError(
        "configuration",
        "An image-description model must be named.",
      );
    }
    this.#apiKey = apiKey;
    this.#model = model;
    this.#endpoint = options.endpoint ?? NVIDIA_CHAT_COMPLETIONS_URL;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = options.timeoutMs ?? 60_000;
    this.#instruction = options.instruction ?? IMAGE_DESCRIPTION_INSTRUCTION;
    this.#maxTokens = options.maxTokens ?? 1024;
  }

  async describe(input: ImageDescriptionInput): Promise<ImageDescription> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);
    const cancel = (): void => controller.abort();
    if (input.signal?.aborted) {
      controller.abort();
    } else {
      input.signal?.addEventListener("abort", cancel, { once: true });
    }

    try {
      const dataUrl = `data:${input.mediaType};base64,${Buffer.from(input.bytes).toString("base64")}`;
      const response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.#model,
          stream: false,
          max_tokens: this.#maxTokens,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: this.#instruction },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new SourceIngestError(
          "description_failed",
          `Image description failed with HTTP ${String(response.status)}.`,
          { mediaType: input.mediaType },
        );
      }

      const body = (await response.json()) as CompletionShape;
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new SourceIngestError(
          "description_failed",
          "Image description response carried no text content.",
          { mediaType: input.mediaType },
        );
      }
      return { description: content, model: this.#model };
    } catch (cause) {
      if (cause instanceof SourceIngestError || isChatError(cause)) {
        throw cause;
      }
      if (timedOut) {
        throw new SourceIngestError(
          "description_failed",
          "Image description timed out.",
          { mediaType: input.mediaType, cause },
        );
      }
      throw new SourceIngestError(
        "description_failed",
        "Image description could not be completed.",
        { mediaType: input.mediaType, cause },
      );
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", cancel);
    }
  }
}
