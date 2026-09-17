import { engineHeaders } from "./engine-access.js";
import {
  modelsResponseSchema,
  type GuiModel,
} from "../../../packages/protocol/src/index.js";
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
): Promise<readonly GuiModel[]> {
  const response = await fetch("/v1/models", {
    cache: "no-store",
    signal,
    headers: engineHeaders(),
  });
  if (!response.ok) throw new Error(`Cannot load models (${response.status}).`);
  const body: unknown = await response.json();
  if (!modelsResponseSchema.safeParse(body).success) {
    throw new Error(
      "Model parameter metadata is unavailable. Restart the current A008 host.",
    );
  }
  return (body as { models: GuiModel[] }).models;
}
