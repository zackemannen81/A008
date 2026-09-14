import type { FrameCheck } from '../../packages/protocol/src/index.js';
import { ChatError } from "../core/errors.js";
import type { FetchLike } from "./provider-routes.js";
import { framePolicyFromHeaders, type FrameBlockReason } from "./frame-policy.js";

export type BrowserFrameCheck = Omit<FrameCheck, 'reason'> & { readonly reason?: FrameBlockReason };

const CHECK_TIMEOUT_MS = 8_000;

export function parseBrowserTargetUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ChatError("configuration", "url is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ChatError("configuration", "url must be an absolute http(s) address.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ChatError("configuration", "url must be http or https.");
  }
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}

export async function handleBrowserFrameCheck(input: {
  readonly url: string;
  readonly embedderOrigin: string;
  readonly fetch: FetchLike;
}): Promise<BrowserFrameCheck> {
  const url = parseBrowserTargetUrl(input.url);
  let response: Response;
  try {
    response = await input.fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "user-agent": "A008-gui-host",
      },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
  } catch {
    return { url, embeddable: true };
  }
  try {
    await response.body?.cancel();
  } catch {
    /* headers are enough */
  }
  const pageUrl = response.url && response.url.length > 0 ? response.url : url;
  const policy = framePolicyFromHeaders(response.headers, input.embedderOrigin, pageUrl);
  return {
    url: pageUrl,
    embeddable: policy.embeddable,
    ...(policy.reason ? { reason: policy.reason } : {}),
  };
}
