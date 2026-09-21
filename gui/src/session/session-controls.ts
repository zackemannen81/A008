import { loadModels as loadModelsFromClient } from "../../../packages/client/src/index.js";
import { guiHttp } from "../client.js";
export {
  isParameters,
  parseSessionSnapshot,
  type SessionParameters,
  type GenerationCapabilities,
  type GuiModel,
  type SessionControl,
  type SessionSnapshot,
} from "../../../packages/protocol/src/index.js";

export async function loadModels(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly import("../../../packages/protocol/src/index.js").GuiModel[]> {
  return loadModelsFromClient(guiHttp(fetchImpl), signal);
}
