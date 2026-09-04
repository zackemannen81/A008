import { ChatError } from "./errors.js";
import type { ModelModality, ModelProfile } from "./types.js";

export const DEFAULT_MODEL_ID = "nvidia/nemotron-3.5-lightning-30b-a3b";

export const NVIDIA_NEMOTRON_35_LIGHTNING: ModelProfile = Object.freeze({
  id: DEFAULT_MODEL_ID,
  name: "NVIDIA Nemotron 3.5 Lightning 30B A3B",
  provider: "nvidia",
  defaults: Object.freeze({
    temperature: 1,
    topP: 0.95,
    maxTokens: 16_384,
    reasoningBudget: 16_384,
    enableThinking: true,
    stream: true,
  }),
  inputModalities: Object.freeze(["text"] as const),
  verifiedOn: "2026-09-01",
});

/*
 * Profiles below carry the vendor's own Build-tab sample values. That tab is
 * the authority, not the model card: for the omni model the card names
 * `nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4` and a 20480 output
 * budget, while the API sample uses the lower-case path id and 65536. A008-0054
 * shipped the card's values and both were wrong against the endpoint.
 *
 * `inputModalities` is read from the sample's payload shape: a sample whose
 * `content` is an array containing `image_url` is a model the endpoint accepts
 * images for. A sample with plain string content is text-only.
 */

/** Text, image, video and audio. Its sample posts an `image_url` block. */
export const NVIDIA_NEMOTRON_3_NANO_OMNI: ModelProfile = Object.freeze({
  id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  name: "NVIDIA Nemotron 3 Nano Omni 30B A3B Reasoning",
  provider: "nvidia",
  defaults: Object.freeze({
    temperature: 0.6,
    topP: 0.95,
    maxTokens: 65_536,
    reasoningBudget: 16_384,
    enableThinking: true,
    stream: true,
  }),
  inputModalities: Object.freeze(["text", "image", "video", "audio"] as const),
  verifiedOn: "2026-09-04",
});

/**
 * Text and image.
 *
 * Its sample carries `reasoning_effort: "max"` and `seed`, neither of which
 * `ChatGenerationOptions` has. `enableThinking` is the closest A008 field and
 * is not the same control, so the effort level is left to the provider default.
 */
export const MOONSHOT_KIMI_K3: ModelProfile = Object.freeze({
  id: "moonshotai/kimi-k3",
  name: "Moonshot Kimi K3",
  provider: "moonshotai",
  defaults: Object.freeze({
    temperature: 1,
    maxTokens: 16_384,
    enableThinking: true,
    stream: true,
  }),
  inputModalities: Object.freeze(["text", "image"] as const),
  verifiedOn: "2026-09-04",
});

/** Text only; its sample posts a plain string and declares no reasoning budget. */
export const DEEPSEEK_V4_PRO: ModelProfile = Object.freeze({
  id: "deepseek-ai/deepseek-v4-pro-0813",
  name: "DeepSeek V4 Pro (0813)",
  provider: "deepseek-ai",
  defaults: Object.freeze({
    temperature: 1,
    topP: 0.95,
    maxTokens: 16_384,
    enableThinking: false,
    stream: true,
  }),
  inputModalities: Object.freeze(["text"] as const),
  verifiedOn: "2026-09-04",
});

/** Text only. */
export const META_MUSE_GLIMMER_30B: ModelProfile = Object.freeze({
  id: "meta/muse-glimmer-30b",
  name: "Meta Muse Glimmer 30B",
  provider: "meta",
  defaults: Object.freeze({
    temperature: 1,
    topP: 0.95,
    maxTokens: 8_192,
    enableThinking: false,
    stream: true,
  }),
  inputModalities: Object.freeze(["text"] as const),
  verifiedOn: "2026-09-04",
});

/** Text only. */
export const POOLSIDE_LAGUNA_XS: ModelProfile = Object.freeze({
  id: "poolside/laguna-xs-2.1",
  name: "Poolside Laguna XS 2.1",
  provider: "poolside",
  defaults: Object.freeze({
    temperature: 1,
    topP: 0.95,
    maxTokens: 8_192,
    enableThinking: false,
    stream: true,
  }),
  inputModalities: Object.freeze(["text"] as const),
  verifiedOn: "2026-09-04",
});

/** True when the model accepts image input, whatever A008 can send today. */
export function acceptsModality(
  profile: ModelProfile,
  modality: ModelModality,
): boolean {
  return profile.inputModalities.includes(modality);
}

export class ModelRegistry {
  readonly #profiles: ReadonlyMap<string, ModelProfile>;

  constructor(profiles: readonly ModelProfile[]) {
    const byId = new Map<string, ModelProfile>();

    for (const profile of profiles) {
      if (byId.has(profile.id)) {
        throw new ChatError(
          "configuration",
          `Duplicate model profile: ${profile.id}`,
        );
      }
      byId.set(profile.id, profile);
    }

    this.#profiles = byId;
  }

  list(): readonly ModelProfile[] {
    return [...this.#profiles.values()];
  }

  get(id: string): ModelProfile | undefined {
    return this.#profiles.get(id);
  }

  require(id: string): ModelProfile {
    const profile = this.get(id);
    if (profile === undefined) {
      throw new ChatError("unknown_model", `Unknown model: ${id}`);
    }
    return profile;
  }
}

export const defaultModelRegistry = new ModelRegistry([
  NVIDIA_NEMOTRON_35_LIGHTNING,
  NVIDIA_NEMOTRON_3_NANO_OMNI,
  MOONSHOT_KIMI_K3,
  DEEPSEEK_V4_PRO,
  META_MUSE_GLIMMER_30B,
  POOLSIDE_LAGUNA_XS,
]);
