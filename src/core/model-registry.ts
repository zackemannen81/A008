import { ChatError } from "./errors.js";
import type { ModelProfile } from "./types.js";

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
});

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
]);
