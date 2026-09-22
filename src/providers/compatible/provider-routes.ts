import { ChatError } from "../../core/errors.js";
import type { ExecutionProvider } from "../../core/types.js";

export type CompatibleExecutionProvider = Extract<
  ExecutionProvider,
  "openrouter" | "groq" | "google" | "opencode"
>;
export type CompatibleApiStyle =
  | "openai-chat-completions"
  | "openai-responses";

interface CompatibleProviderPolicy {
  readonly provider: CompatibleExecutionProvider;
  readonly baseUrl: string;
  readonly credentialEnv: string;
}

const POLICIES: Readonly<
  Record<CompatibleExecutionProvider, CompatibleProviderPolicy>
> = Object.freeze({
  openrouter: {
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    credentialEnv: "OPENROUTER_API_KEY",
  },
  groq: {
    provider: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    credentialEnv: "GROQ_API_KEY",
  },
  google: {
    provider: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    credentialEnv: "GEMINI_API_KEY",
  },
  opencode: {
    provider: "opencode",
    baseUrl: "https://opencode.ai/zen/v1",
    credentialEnv: "OPENCODE_API_KEY",
  },
});

export function isCompatibleExecutionProvider(
  provider: string,
): provider is CompatibleExecutionProvider {
  return (
    provider === "openrouter" ||
    provider === "groq" ||
    provider === "google" ||
    provider === "opencode"
  );
}

export function normalizeProviderBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/u, "");
}

export function compatibleProviderPolicy(
  provider: string,
): CompatibleProviderPolicy {
  if (!isCompatibleExecutionProvider(provider)) {
    throw new ChatError(
      "configuration",
      `Unsupported OpenAI-compatible provider: ${provider}.`,
    );
  }
  return POLICIES[provider];
}

export function assertSupportedCompatibleRoute(input: {
  readonly provider: string;
  readonly baseUrl: string;
  readonly apiStyle: CompatibleApiStyle;
}): CompatibleProviderPolicy {
  const policy = compatibleProviderPolicy(input.provider);
  const baseUrl = normalizeProviderBaseUrl(input.baseUrl);
  if (baseUrl !== policy.baseUrl) {
    throw new ChatError(
      "configuration",
      `Unsupported ${policy.provider} base URL: ${input.baseUrl}.`,
    );
  }
  if (input.apiStyle !== "openai-chat-completions") {
    throw new ChatError(
      "configuration",
      `${policy.provider} route uses unsupported API style ${input.apiStyle}.`,
    );
  }
  return policy;
}

export function compatibleChatCompletionsEndpoint(baseUrl: string): string {
  return `${normalizeProviderBaseUrl(baseUrl)}/chat/completions`;
}

export function compatibleCredentialEnv(provider: string): string {
  return compatibleProviderPolicy(provider).credentialEnv;
}
