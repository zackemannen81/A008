import { ChatError } from "./errors.js";
import type { ChatGenerationOptions, ModelProfile } from "./types.js";

import type {
  SessionParameters,
  GenerationCapabilities,
} from "../../packages/protocol/src/index.js";
export type {
  SessionParameters,
  GenerationCapabilities,
} from "../../packages/protocol/src/index.js";

// Hosted NVIDIA API schemas, checked 2026-09-06 (sources in ADR 0026).
// This describes exposed controls, not every capability of model weights.
export function generationCapabilities(model: string): GenerationCapabilities {
  const common = {
    topP: true,
    thinking: false,
    reasoningBudget: null,
    reasoningEfforts: [],
    seed: true,
    stop: false,
    verifiedOn: "2026-09-06",
  };
  switch (model) {
    case "nvidia/nemotron-3.5-lightning-30b-a3b":
      return {
        ...common,
        maxTokens: 32768,
        thinking: true,
        reasoningBudget: 32768,
        stop: true,
      };
    case "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning":
      return {
        ...common,
        maxTokens: 65536,
        thinking: true,
        reasoningBudget: 32768,
      };
    case "moonshotai/kimi-k3":
      return {
        ...common,
        maxTokens: 65536,
        topP: false,
        reasoningEfforts: ["low", "high", "max"],
      };
    case "deepseek-ai/deepseek-v4-pro-0813":
      return {
        ...common,
        maxTokens: 16384,
        reasoningEfforts: ["none", "high", "max"],
      };
    case "meta/muse-glimmer-30b":
      return {
        ...common,
        maxTokens: 131072,
        stop: true,
        reasoningEfforts: ["none", "minimal", "low", "medium", "high", "max"],
      };
    case "poolside/laguna-xs-2.1":
      return { ...common, maxTokens: 16384, seed: false };
    case "gpt-5.6-luna":
      return {
        ...common,
        maxTokens: 128000,
        topP: false,
        reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
        seed: false,
        verifiedOn: "2026-09-09",
      };
    default:
      return {
        ...common,
        maxTokens: 16384,
        verifiedOn: "unverified",
      };
  }
}

export function defaultSessionParameters(
  profile: ModelProfile,
  overrides: ChatGenerationOptions = {},
): SessionParameters {
  const options = { ...profile.defaults, ...overrides };
  const caps = generationCapabilities(profile.id);
  const effort =
    caps.reasoningEfforts.length === 0
      ? null
      : (options.reasoningEffort ?? null);
  return {
    stream: options.stream ?? true,
    temperature: options.temperature ?? null,
    topP: caps.topP ? (options.topP ?? null) : null,
    maxTokens: options.maxTokens ?? 8192,
    enableThinking: caps.thinking ? (options.enableThinking ?? true) : null,
    reasoningBudget:
      caps.reasoningBudget === null ? null : (options.reasoningBudget ?? null),
    reasoningEffort: effort,
    seed: null,
    stop: null,
  };
}

export function parseSessionParameters(
  value: unknown,
  model: string,
): SessionParameters {
  const fail = (message: string): never => {
    throw new ChatError("configuration", message);
  };
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return fail("Parameters must be an object.");
  const input = value as Record<string, unknown>;
  const keys = [
    "stream",
    "temperature",
    "topP",
    "maxTokens",
    "enableThinking",
    "reasoningBudget",
    "reasoningEffort",
    "seed",
    "stop",
  ];
  if (
    Object.keys(input).some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in input))
  ) {
    return fail("Parameters must contain exactly the documented fields.");
  }
  const caps = generationCapabilities(model);
  const number = (
    key: string,
    min: number,
    max: number,
    integer = false,
  ): number => {
    const n = input[key];
    if (
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (integer && !Number.isSafeInteger(n))
    ) {
      return fail(
        `${key} must be ${integer ? "a whole number" : "a number"} from ${min} to ${max}.`,
      );
    }
    return n;
  };
  const unsupported = (key: string, supported: boolean): void => {
    if (!supported && input[key] !== null)
      fail(`${key} is not supported for ${model}.`);
  };
  if (typeof input.stream !== "boolean")
    return fail("stream must be a boolean.");
  if (
    input.enableThinking !== null &&
    typeof input.enableThinking !== "boolean"
  )
    return fail("enableThinking must be boolean or null.");
  unsupported("enableThinking", caps.thinking);
  unsupported("topP", caps.topP);
  unsupported("reasoningBudget", caps.reasoningBudget !== null);
  unsupported("reasoningEffort", caps.reasoningEfforts.length > 0);
  unsupported("seed", caps.seed);
  unsupported("stop", caps.stop);
  const maxTokens = number("maxTokens", 1, caps.maxTokens, true);
  const reasoningBudget =
    input.reasoningBudget === null
      ? null
      : number("reasoningBudget", -1, caps.reasoningBudget ?? 0, true);
  if (
    input.enableThinking !== false &&
    reasoningBudget !== null &&
    reasoningBudget > maxTokens
  )
    return fail(
      "Reasoning budget cannot exceed the total generated-token budget.",
    );
  if (
    input.reasoningEffort !== null &&
    (typeof input.reasoningEffort !== "string" ||
      !caps.reasoningEfforts.includes(input.reasoningEffort))
  )
    return fail("Unsupported reasoning effort.");
  if (
    input.stop !== null &&
    (!Array.isArray(input.stop) ||
      input.stop.length < 1 ||
      input.stop.length > 4 ||
      input.stop.some(
        (s) => typeof s !== "string" || s.length === 0 || s.length > 256,
      ))
  ) {
    return fail(
      "stop must be null or 1–4 non-empty strings of at most 256 characters.",
    );
  }
  return {
    stream: input.stream,
    temperature:
      input.temperature === null ? null : number("temperature", 0, 1),
    topP: input.topP === null ? null : number("topP", 0, 1),
    maxTokens,
    enableThinking: input.enableThinking as boolean | null,
    reasoningBudget,
    reasoningEffort: input.reasoningEffort as string | null,
    seed:
      input.seed === null
        ? null
        : number("seed", 0, Number.MAX_SAFE_INTEGER, true),
    stop: input.stop === null ? null : [...(input.stop as string[])],
  };
}

export function chatGeneration(
  parameters: SessionParameters,
): ChatGenerationOptions {
  return {
    ...parameters,
    stop: parameters.stop === null ? null : [...parameters.stop],
    reasoningBudget:
      parameters.enableThinking === false ? null : parameters.reasoningBudget,
  };
}
