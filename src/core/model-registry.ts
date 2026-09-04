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

/**
 * Nemotron 3 Nano Omni, thinking mode.
 *
 * The id is case-sensitive and is one of three precision variants the vendor
 * publishes; NVFP4 is the one named here. The other two, `-BF16` and `-FP8`,
 * are different ids and would need their own profiles rather than a flag.
 *
 * Defaults are the vendor's documented thinking-mode values, which differ from
 * its instruct mode (temperature 0.2, top_k 1, 1024 output tokens). A008 has no
 * top_k option, so instruct mode is not expressible as a profile today.
 *
 * `image`, `video` and `audio` are declared because the model accepts them.
 * A008 cannot yet send them: `ChatMessage.content` is a `string` (ADR 0020 D6).
 * The declaration is what a caller reads to know that gap exists.
 */
export const NVIDIA_NEMOTRON_3_NANO_OMNI: ModelProfile = Object.freeze({
  id: "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
  name: "NVIDIA Nemotron 3 Nano Omni 30B A3B Reasoning (NVFP4)",
  provider: "nvidia",
  defaults: Object.freeze({
    temperature: 0.6,
    topP: 0.95,
    maxTokens: 20_480,
    reasoningBudget: 16_384,
    enableThinking: true,
    stream: true,
  }),
  inputModalities: Object.freeze(["text", "image", "video", "audio"] as const),
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
]);
