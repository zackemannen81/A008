import { ChatError } from "../../core/errors.js";
import { KIE_API_ORIGIN } from "./kie-models.js";

export const KIE_CREATE_TASK_URL = `${KIE_API_ORIGIN}/api/v1/jobs/createTask`;
export const KIE_RECORD_INFO_URL = `${KIE_API_ORIGIN}/api/v1/jobs/recordInfo`;

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface KieJobTransportOptions {
  readonly apiKey: string;
  readonly fetch?: FetchLike;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly pollMs?: number;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseKieCreateTask(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.data) || typeof value.data.taskId !== "string") {
    throw new ChatError("provider", "kie.ai did not return a taskId.");
  }
  if (value.code !== undefined && value.code !== 200) {
    throw new ChatError(
      "provider",
      typeof value.msg === "string" ? value.msg : `kie.ai createTask failed (${String(value.code)}).`,
    );
  }
  const id = value.data.taskId.trim();
  if (!id) throw new ChatError("provider", "kie.ai returned an empty taskId.");
  return id;
}

export function parseKieResultUrls(value: unknown): readonly string[] {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new ChatError("provider", "kie.ai recordInfo was not a JSON object.");
  }
  const state = typeof value.data.state === "string" ? value.data.state : "";
  if (state === "fail") {
    throw new ChatError(
      "provider",
      typeof value.data.failMsg === "string" && value.data.failMsg
        ? value.data.failMsg
        : "kie.ai generation failed.",
    );
  }
  if (state !== "success") return [];
  const raw = value.data.resultJson;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new ChatError("provider", "kie.ai success response had no resultJson.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ChatError("provider", "kie.ai resultJson was not JSON.");
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.resultUrls)) {
    throw new ChatError("provider", "kie.ai resultJson had no resultUrls.");
  }
  return parsed.resultUrls.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export class KieJobTransport {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;
  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #pollMs: number;
  readonly #timeoutMs: number;

  constructor(options: KieJobTransportOptions) {
    const apiKey = options.apiKey.trim();
    if (apiKey.length === 0) {
      throw new ChatError("configuration", "KIE_API_KEY is required for kie.ai generation.");
    }
    this.#apiKey = apiKey;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#now = options.now ?? Date.now;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.#pollMs = options.pollMs ?? 2000;
    this.#timeoutMs = options.timeoutMs ?? 180_000;
  }

  async generateImage(model: string, prompt: string): Promise<{ bytes: Buffer; mediaType: "image/png" | "image/jpeg" }> {
    const trimmed = prompt.trim();
    if (trimmed.length < 3) {
      throw new ChatError("configuration", "Image prompt must be at least 3 characters.");
    }
    const created = await this.#json(KIE_CREATE_TASK_URL, {
      method: "POST",
      body: JSON.stringify({
        model,
        input: { prompt: trimmed, aspect_ratio: "1:1", resolution: "1K" },
      }),
    });
    const taskId = parseKieCreateTask(created);
    const deadline = this.#now() + this.#timeoutMs;
    while (this.#now() < deadline) {
      const info = await this.#json(
        `${KIE_RECORD_INFO_URL}?taskId=${encodeURIComponent(taskId)}`,
        { method: "GET" },
      );
      const urls = parseKieResultUrls(info);
      if (urls.length > 0) {
        const url = urls[0]!;
        const response = await this.#fetch(url, { method: "GET" });
        if (!response.ok) {
          throw new ChatError("provider", `Failed to download kie.ai result (${response.status}).`);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        const mediaType =
          bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
            ? "image/jpeg"
            : "image/png";
        return { bytes, mediaType };
      }
      await this.#sleep(this.#pollMs);
    }
    throw new ChatError("timeout", "kie.ai image generation timed out.");
  }

  async #json(url: string, init: { method: string; body?: string }): Promise<unknown> {
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: init.method,
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          accept: "application/json",
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
        ...(init.body ? { body: init.body } : {}),
      });
    } catch (cause) {
      throw new ChatError("network", "Failed to reach kie.ai.", { cause, retryable: true });
    }
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new ChatError("provider", "kie.ai returned non-JSON.");
    }
    if (!response.ok) {
      const msg = isRecord(payload) && typeof payload.msg === "string" ? payload.msg : `kie.ai failed (${response.status}).`;
      throw new ChatError("provider", msg);
    }
    return payload;
  }
}
