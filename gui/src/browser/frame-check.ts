import { checkFrame as checkFrameFromClient } from "../../../packages/client/src/index.js";
import type { FrameCheck } from "../../../packages/protocol/src/index.js";
export type { FrameCheck } from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

export async function checkFrame(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FrameCheck> {
  return checkFrameFromClient(guiHttp(fetchImpl), url);
}
