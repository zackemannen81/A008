/**
 * Provider/model routes whose zero-cost availability was revalidated against
 * provider-owned current documentation on 2026-09-19.
 *
 * This module is DATA ONLY. Importing it does not register a provider, enable a
 * model, change routing, authorize credentials, or permit paid fallback.
 *
 * "Zero cost" is scoped to the access mechanism recorded on each route:
 * - free-endpoint: a hosted endpoint currently labelled free by the provider
 * - free-model: the exact model slug is currently priced at zero
 * - free-tier: the provider has a zero-cost quota while ordinary model pricing
 *   can still exist outside that tier
 *
 * Dynamic, preview and trial routes must be revalidated before unattended use.
 * Consumers must fail closed rather than silently substituting a paid route.
 */

export const ZERO_COST_MODEL_CATALOG_VERIFIED_AT = "2026-09-19" as const;

export type ZeroCostAccess =
  | "free-endpoint"
  | "free-model"
  | "free-tier";

export type ZeroCostLifecycle =
  | "recurring"
  | "dynamic"
  | "preview"
  | "trial";

export type ZeroCostApiStyle =
  | "openai-chat-completions"
  | "openai-responses";

export type ZeroCostInputModality =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "pdf";

export type ZeroCostCapability =
  | "agentic"
  | "coding"
  | "reasoning"
  | "tools"
  | "structured-output"
  | "code-execution"
  | "long-context"
  | "multimodal";

export type ZeroCostDataPolicy =
  | "review-before-sensitive-use"
  | "do-not-send-sensitive-data";

export interface ZeroCostModelRoute {
  readonly key: string;
  readonly provider: "nvidia" | "opencode" | "openrouter" | "groq" | "google";
  readonly modelId: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly apiStyle: ZeroCostApiStyle;
  readonly access: ZeroCostAccess;
  readonly lifecycle: ZeroCostLifecycle;
  readonly contextWindow?: number;
  readonly maxOutputTokens?: number;
  readonly inputModalities?: readonly ZeroCostInputModality[];
  readonly capabilities?: readonly ZeroCostCapability[];
  readonly quota?: string;
  readonly expiresAt?: string;
  readonly dataPolicy: ZeroCostDataPolicy;
  readonly a008ProfileId?: string;
  readonly note?: string;
  readonly verifiedAt: typeof ZERO_COST_MODEL_CATALOG_VERIFIED_AT;
  readonly sourceUrls: readonly string[];
}

/**
 * Current zero-cost candidates for A008.
 *
 * Entries with a008ProfileId already have a profile in A008's current
 * ModelRegistry, but this file deliberately does not import or mutate that
 * registry. Entries without a008ProfileId are catalog-only until a separate,
 * authorized provider task implements them.
 */
export const ZERO_COST_MODEL_ROUTES = [
  // NVIDIA Build hosted prototype endpoints.
  {
    key: "nvidia:kimi-k3",
    provider: "nvidia",
    modelId: "moonshotai/kimi-k3",
    name: "Moonshot Kimi K3",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions",
    access: "free-endpoint",
    lifecycle: "trial",
    contextWindow: 1_000_000,
    inputModalities: ["text", "image"],
    capabilities: ["agentic", "coding", "reasoning", "tools", "long-context", "multimodal"],
    dataPolicy: "review-before-sensitive-use",
    a008ProfileId: "moonshotai/kimi-k3",
    note: "NVIDIA Build currently labels the hosted prototype as Free Endpoint.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://build.nvidia.com/moonshotai/kimi-k3?section=deploy",
      "https://build.nvidia.com/models",
    ],
  },
  {
    key: "nvidia:nemotron-3.5-lightning",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3.5-lightning-30b-a3b",
    name: "NVIDIA Nemotron 3.5 Lightning 30B A3B",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions",
    access: "free-endpoint",
    lifecycle: "trial",
    inputModalities: ["text"],
    capabilities: ["agentic", "reasoning"],
    dataPolicy: "review-before-sensitive-use",
    a008ProfileId: "nvidia/nemotron-3.5-lightning-30b-a3b",
    note: "NVIDIA Build currently labels this model Downloadable Free Endpoint.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://build.nvidia.com/models",
      "https://build.nvidia.com/explore/reasoning",
    ],
  },
  {
    key: "nvidia:nemotron-3-nano-omni",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    name: "NVIDIA Nemotron 3 Nano Omni 30B A3B Reasoning",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions",
    access: "free-endpoint",
    lifecycle: "trial",
    inputModalities: ["text", "image", "audio", "video"],
    capabilities: ["reasoning", "multimodal"],
    dataPolicy: "review-before-sensitive-use",
    a008ProfileId: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    note: "NVIDIA Build currently labels this omni-modal model Downloadable Free Endpoint.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://build.nvidia.com/models"],
  },
  {
    key: "nvidia:muse-glimmer-30b",
    provider: "nvidia",
    modelId: "meta/muse-glimmer-30b",
    name: "Meta Muse Glimmer 30B",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions",
    access: "free-endpoint",
    lifecycle: "trial",
    inputModalities: ["text", "image"],
    capabilities: ["reasoning", "tools", "multimodal"],
    dataPolicy: "review-before-sensitive-use",
    a008ProfileId: "meta/muse-glimmer-30b",
    note: "NVIDIA Build currently labels this model Downloadable Free Endpoint.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://build.nvidia.com/models"],
  },
  {
    key: "nvidia:laguna-xs-2.1",
    provider: "nvidia",
    modelId: "poolside/laguna-xs-2.1",
    name: "Poolside Laguna XS 2.1",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions",
    access: "free-endpoint",
    lifecycle: "trial",
    inputModalities: ["text"],
    capabilities: ["agentic", "coding", "reasoning", "tools"],
    dataPolicy: "review-before-sensitive-use",
    a008ProfileId: "poolside/laguna-xs-2.1",
    note: "NVIDIA Build currently labels this model Free Endpoint.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://build.nvidia.com/models"],
  },
  {
    key: "nvidia:deepseek-v4-pro-0813",
    provider: "nvidia",
    modelId: "deepseek-ai/deepseek-v4-pro-0813",
    name: "DeepSeek V4 Pro 0813",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions",
    access: "free-endpoint",
    lifecycle: "trial",
    contextWindow: 262_144,
    inputModalities: ["text"],
    capabilities: ["agentic", "coding", "reasoning"],
    dataPolicy: "review-before-sensitive-use",
    a008ProfileId: "deepseek-ai/deepseek-v4-pro-0813",
    note: "NVIDIA Build currently labels this model Downloadable Free Endpoint.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://build.nvidia.com/explore/reasoning"],
  },
  {
    key: "nvidia:nemotron-3-ultra",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3-ultra-550b-a55b",
    name: "NVIDIA Nemotron 3 Ultra 550B A55B",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions",
    access: "free-endpoint",
    lifecycle: "trial",
    contextWindow: 1_000_000,
    inputModalities: ["text"],
    capabilities: ["agentic", "coding", "reasoning", "tools", "long-context"],
    dataPolicy: "review-before-sensitive-use",
    note: "Catalog-only in A008; NVIDIA Build currently labels it Downloadable Free Endpoint.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://build.nvidia.com/models"],
  },
  {
    key: "nvidia:nemotron-3-super",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3-super-120b-a12b",
    name: "NVIDIA Nemotron 3 Super 120B A12B",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiStyle: "openai-chat-completions",
    access: "free-endpoint",
    lifecycle: "trial",
    contextWindow: 1_000_000,
    inputModalities: ["text"],
    capabilities: ["reasoning", "long-context"],
    dataPolicy: "review-before-sensitive-use",
    note: "Catalog-only in A008; NVIDIA Build currently labels it Downloadable Free Endpoint.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://build.nvidia.com/models"],
  },

  // OpenCode Zen rotating zero-price pool. Exact slugs matter.
  {
    key: "opencode:big-pickle",
    provider: "opencode",
    modelId: "big-pickle",
    name: "Big Pickle",
    baseUrl: "https://opencode.ai/zen/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    dataPolicy: "do-not-send-sensitive-data",
    note: "Limited-time free model; OpenCode says collected data may be used to improve the model during its free period.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://opencode.ai/v2/docs/console/models/",
      "https://opencode.ai/docs/zen",
    ],
  },
  {
    key: "opencode:deepseek-v4-flash",
    provider: "opencode",
    modelId: "deepseek-v4-flash-free",
    name: "DeepSeek V4 Flash Free",
    baseUrl: "https://opencode.ai/zen/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    dataPolicy: "review-before-sensitive-use",
    note: "Limited-time free model; fail closed if the exact free slug disappears.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://opencode.ai/v2/docs/console/models/"],
  },
  {
    key: "opencode:mimo-v2.5",
    provider: "opencode",
    modelId: "mimo-v2.5-free",
    name: "MiMo-V2.5 Free",
    baseUrl: "https://opencode.ai/zen/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    dataPolicy: "do-not-send-sensitive-data",
    note: "Limited-time free model; OpenCode says collected data may be used to improve the model during its free period.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://opencode.ai/v2/docs/console/models/",
      "https://opencode.ai/docs/zen",
    ],
  },
  {
    key: "opencode:laguna-s-2.1",
    provider: "opencode",
    modelId: "laguna-s-2.1-free",
    name: "Laguna S 2.1 Free",
    baseUrl: "https://opencode.ai/zen/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    dataPolicy: "review-before-sensitive-use",
    note: "Limited-time free model; fail closed if the exact free slug disappears.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://opencode.ai/v2/docs/console/models/"],
  },
  {
    key: "opencode:ling-3.0-tiny",
    provider: "opencode",
    modelId: "ling-3.0-tiny-free",
    name: "Ling 3.0 Tiny Free",
    baseUrl: "https://opencode.ai/zen/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    dataPolicy: "review-before-sensitive-use",
    note: "Limited-time free model; fail closed if the exact free slug disappears.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://opencode.ai/v2/docs/console/models/"],
  },
  {
    key: "opencode:longcat-2.0",
    provider: "opencode",
    modelId: "longcat-2.0-free",
    name: "LongCat 2.0 Free",
    baseUrl: "https://opencode.ai/zen/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    dataPolicy: "review-before-sensitive-use",
    note: "Limited-time free model; fail closed if the exact free slug disappears.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://opencode.ai/v2/docs/console/models/"],
  },
  {
    key: "opencode:north-mini-code",
    provider: "opencode",
    modelId: "north-mini-code-free",
    name: "North Mini Code Free",
    baseUrl: "https://opencode.ai/zen/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    capabilities: ["coding"],
    dataPolicy: "review-before-sensitive-use",
    note: "Limited-time free model; fail closed if the exact free slug disappears.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://opencode.ai/v2/docs/console/models/"],
  },
  {
    key: "opencode:nemotron-3-ultra",
    provider: "opencode",
    modelId: "nemotron-3-ultra-free",
    name: "Nemotron 3 Ultra Free",
    baseUrl: "https://opencode.ai/zen/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    capabilities: ["agentic", "coding", "reasoning", "tools", "long-context"],
    dataPolicy: "do-not-send-sensitive-data",
    note: "NVIDIA free-endpoint trial terms apply through Zen; do not submit personal or confidential data.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://opencode.ai/v2/docs/console/models/",
      "https://opencode.ai/docs/zen",
    ],
  },

  // OpenRouter exact :free slugs.
  {
    key: "openrouter:inkling",
    provider: "openrouter",
    modelId: "thinkingmachines/inkling:free",
    name: "Thinking Machines Inkling Free",
    baseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    contextWindow: 1_048_576,
    maxOutputTokens: 262_144,
    inputModalities: ["text", "image", "audio"],
    capabilities: ["agentic", "coding", "reasoning", "tools", "long-context", "multimodal"],
    dataPolicy: "do-not-send-sensitive-data",
    note: "Free research endpoint is restricted to agentic harnesses; prompts and outputs are logged for model improvement.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://openrouter.ai/thinkingmachines/inkling:free"],
  },
  {
    key: "openrouter:inkling-small",
    provider: "openrouter",
    modelId: "thinkingmachines/inkling-small:free",
    name: "Thinking Machines Inkling Small Free",
    baseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    contextWindow: 1_048_576,
    maxOutputTokens: 262_144,
    inputModalities: ["text", "image", "audio"],
    capabilities: ["agentic", "coding", "reasoning", "tools", "long-context", "multimodal"],
    dataPolicy: "do-not-send-sensitive-data",
    note: "Free research endpoint is restricted to agentic harnesses; prompts and outputs are logged for model improvement.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://openrouter.ai/thinkingmachines/inkling-small:free"],
  },
  {
    key: "openrouter:nex-n2.5-pro",
    provider: "openrouter",
    modelId: "nex-agi/nex-n2.5-pro:free",
    name: "Nex AGI Nex-N2.5-Pro Free",
    baseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai-responses",
    access: "free-model",
    lifecycle: "dynamic",
    contextWindow: 262_144,
    inputModalities: ["text", "image"],
    capabilities: ["agentic", "coding", "reasoning", "tools", "structured-output", "multimodal"],
    dataPolicy: "review-before-sensitive-use",
    note: "Exact :free slug is zero-priced; OpenRouter also exposes paid Nex siblings.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://openrouter.ai/nex-agi/nex-n2.5-pro:free"],
  },
  {
    key: "openrouter:nemotron-3.5-lightning",
    provider: "openrouter",
    modelId: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 Lightning Free",
    baseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    inputModalities: ["text"],
    capabilities: ["agentic", "reasoning", "tools", "long-context"],
    dataPolicy: "do-not-send-sensitive-data",
    note: "Exact :free slug is zero-priced and rate-limited.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://openrouter.ai/nvidia/nemotron-3.5-lightning:free"],
  },
  {
    key: "openrouter:nemotron-3-ultra",
    provider: "openrouter",
    modelId: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA Nemotron 3 Ultra Free",
    baseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "dynamic",
    contextWindow: 1_000_000,
    inputModalities: ["text"],
    capabilities: ["agentic", "coding", "reasoning", "tools", "long-context"],
    dataPolicy: "do-not-send-sensitive-data",
    note: "NVIDIA free-endpoint trial terms apply; do not submit personal or confidential data.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free"],
  },
  {
    key: "openrouter:dots3-note-preview",
    provider: "openrouter",
    modelId: "dots-studio/dots-3-note-preview:free",
    name: "Dots3-Note Preview Free",
    baseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai-chat-completions",
    access: "free-model",
    lifecycle: "preview",
    contextWindow: 512_000,
    capabilities: ["agentic", "coding", "reasoning", "long-context", "multimodal"],
    expiresAt: "2026-09-30",
    dataPolicy: "review-before-sensitive-use",
    note: "OpenRouter explicitly says this free preview goes away on 2026-09-30.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: ["https://openrouter.ai/dots-studio/dots-3-note-preview:free"],
  },

  // Groq models have ordinary token prices, but the Free Plan currently has
  // separate model-specific request/token limits. Do not classify these as
  // globally zero-priced models.
  {
    key: "groq:gpt-oss-120b",
    provider: "groq",
    modelId: "openai/gpt-oss-120b",
    name: "OpenAI GPT-OSS 120B on Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiStyle: "openai-chat-completions",
    access: "free-tier",
    lifecycle: "recurring",
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    inputModalities: ["text"],
    capabilities: ["agentic", "coding", "reasoning", "tools", "structured-output", "code-execution"],
    quota: "Free Plan: 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD.",
    dataPolicy: "review-before-sensitive-use",
    note: "Free Plan quota only; normal Groq token pricing exists outside the free allowance.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://console.groq.com/docs/rate-limits",
      "https://console.groq.com/docs/model/openai/gpt-oss-120b",
    ],
  },
  {
    key: "groq:gpt-oss-20b",
    provider: "groq",
    modelId: "openai/gpt-oss-20b",
    name: "OpenAI GPT-OSS 20B on Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiStyle: "openai-chat-completions",
    access: "free-tier",
    lifecycle: "recurring",
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    inputModalities: ["text"],
    capabilities: ["coding", "reasoning", "tools", "structured-output"],
    quota: "Free Plan: 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD.",
    dataPolicy: "review-before-sensitive-use",
    note: "Free Plan quota only; normal Groq token pricing exists outside the free allowance.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://console.groq.com/docs/rate-limits",
      "https://console.groq.com/docs/models",
    ],
  },
  {
    key: "groq:qwen3.8-27b",
    provider: "groq",
    modelId: "qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B on Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiStyle: "openai-chat-completions",
    access: "free-tier",
    lifecycle: "preview",
    inputModalities: ["text"],
    capabilities: ["reasoning", "structured-output"],
    quota: "Free Plan: 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD.",
    dataPolicy: "review-before-sensitive-use",
    note: "Preview model under Groq Free Plan limits; preview models may be discontinued at short notice.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://console.groq.com/docs/rate-limits",
      "https://console.groq.com/docs/models",
    ],
  },

  // Gemini Developer API Free Tier. Free-tier requests may be used to improve
  // Google's products; keep sensitive/private material off this route.
  {
    key: "google:gemini-3.8-flash",
    provider: "google",
    modelId: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiStyle: "openai-chat-completions",
    access: "free-tier",
    lifecycle: "recurring",
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    inputModalities: ["text", "image", "audio", "video", "pdf"],
    capabilities: ["agentic", "coding", "reasoning", "tools", "structured-output", "code-execution", "long-context", "multimodal"],
    quota: "Free Tier is zero-priced within model/account rate limits; check the live quota for the project.",
    dataPolicy: "do-not-send-sensitive-data",
    note: "Google marks Free Tier input/output/context caching as free of charge; Free Tier data may be used to improve products.",
    verifiedAt: ZERO_COST_MODEL_CATALOG_VERIFIED_AT,
    sourceUrls: [
      "https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash",
      "https://ai.google.dev/gemini-api/docs/pricing",
      "https://ai.google.dev/gemini-api/docs/openai",
    ],
  },
] as const satisfies readonly ZeroCostModelRoute[];
