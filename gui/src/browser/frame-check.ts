import {
  parseFrameCheck,
  type FrameCheck,
} from "../../../packages/protocol/src/index.js";
export type { FrameCheck } from "../../../packages/protocol/src/index.js";
import { engineHeaders } from "../session/engine-access.js";

export async function checkFrame(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FrameCheck> {
  const response = await fetchImpl(
    `/v1/browser/frame-check?url=${encodeURIComponent(url)}`,
    {
      headers: { ...engineHeaders(), accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { url, embeddable: true };
  }
  return parseFrameCheck(await response.json(), url);
}
