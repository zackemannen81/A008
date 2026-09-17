export const KIE_API_ORIGIN = "https://api.kie.ai";

export type KieModelKind = "chat" | "image" | "video";

export interface KieMarketModel {
  readonly id: string;
  readonly name: string;
  readonly kind: KieModelKind;
}

export const KIE_MARKET_MODELS: readonly KieMarketModel[] = [
  { id: "gemini-3-flash", name: "Gemini 3 Flash", kind: "chat" },
  { id: "gemini-3-pro", name: "Gemini 3 Pro", kind: "chat" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", kind: "chat" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", kind: "chat" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", kind: "chat" },
  {
    id: "flux-2/flex-text-to-image",
    name: "FLUX.2 Flex text-to-image",
    kind: "image",
  },
  { id: "google/imagen4-fast", name: "Google Imagen 4 Fast", kind: "image" },
  {
    id: "grok-imagine/text-to-image",
    name: "Grok Imagine text-to-image",
    kind: "image",
  },
  { id: "qwen/text-to-image", name: "Qwen text-to-image", kind: "image" },
  {
    id: "kling/v3-turbo-text-to-video",
    name: "Kling V3 Turbo text-to-video",
    kind: "video",
  },
  { id: "wan/2-6-text-to-video", name: "Wan 2.6 text-to-video", kind: "video" },
];

export const DEFAULT_KIE_CHAT_MODEL = "gemini-3-flash";
export const DEFAULT_KIE_IMAGE_MODEL = "flux-2/flex-text-to-image";

export function kieChatCompletionsUrl(model: string): string {
  return `${KIE_API_ORIGIN}/${encodeURIComponent(model)}/v1/chat/completions`;
}

export function isKieChatModelId(id: string): boolean {
  return KIE_MARKET_MODELS.some(
    (model) => model.id === id && model.kind === "chat",
  );
}
