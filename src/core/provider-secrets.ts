import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ChatError } from "./errors.js";
import type { CompatibleExecutionProvider } from "../providers/compatible/provider-routes.js";

export const SECRETS_PATH_ENV = "A008_SECRETS_PATH";

export interface ProviderSecrets {
  readonly nvidiaApiKey: string | undefined;
  readonly kieApiKey: string | undefined;
  readonly openAiApiKey: string | undefined;
  readonly openRouterApiKey?: string | undefined;
  readonly groqApiKey?: string | undefined;
  readonly geminiApiKey?: string | undefined;
  readonly openCodeApiKey?: string | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function defaultSecretsPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env[SECRETS_PATH_ENV]?.trim();
  return resolve(configured || join(homedir(), ".a008", "secrets.json"));
}

export function parseProviderSecrets(value: unknown): ProviderSecrets {
  if (!isRecord(value) || value.version !== 1) {
    throw new ChatError(
      "configuration",
      "Secrets file must be a version 1 document.",
    );
  }
  const nvidia = optionalKey(value.nvidiaApiKey, "nvidiaApiKey");
  const kie = optionalKey(value.kieApiKey, "kieApiKey");
  const openAi = optionalKey(value.openAiApiKey, "openAiApiKey");
  const openRouter = optionalKey(value.openRouterApiKey, "openRouterApiKey");
  const groq = optionalKey(value.groqApiKey, "groqApiKey");
  const gemini = optionalKey(value.geminiApiKey, "geminiApiKey");
  const openCode = optionalKey(value.openCodeApiKey, "openCodeApiKey");
  return {
    nvidiaApiKey: nvidia,
    kieApiKey: kie,
    openAiApiKey: openAi,
    openRouterApiKey: openRouter,
    groqApiKey: groq,
    geminiApiKey: gemini,
    openCodeApiKey: openCode,
  };
}
function optionalKey(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ChatError(
      "configuration",
      `${field} must be a non-empty string when set.`,
    );
  }
  return value.trim();
}

export function loadProviderSecrets(path: string): ProviderSecrets {
  if (!existsSync(path))
    return {
      nvidiaApiKey: undefined,
      kieApiKey: undefined,
      openAiApiKey: undefined,
      openRouterApiKey: undefined,
      groqApiKey: undefined,
      geminiApiKey: undefined,
      openCodeApiKey: undefined,
    };
  try {
    return parseProviderSecrets(
      JSON.parse(readFileSync(path, "utf8")) as unknown,
    );
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError(
      "configuration",
      "Cannot read the provider secrets file.",
    );
  }
}

export function saveProviderSecrets(
  path: string,
  secrets: ProviderSecrets,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        nvidiaApiKey: secrets.nvidiaApiKey ?? null,
        kieApiKey: secrets.kieApiKey ?? null,
        openAiApiKey: secrets.openAiApiKey ?? null,
        openRouterApiKey: secrets.openRouterApiKey ?? null,
        groqApiKey: secrets.groqApiKey ?? null,
        geminiApiKey: secrets.geminiApiKey ?? null,
        openCodeApiKey: secrets.openCodeApiKey ?? null,
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

/** Environment wins; otherwise the secrets file. Never logs the value. */
export function resolveNvidiaApiKey(
  env: NodeJS.ProcessEnv,
  secretsPath: string,
): string | undefined {
  const fromEnv = env.NVIDIA_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return loadProviderSecrets(secretsPath).nvidiaApiKey;
}

export function resolveKieApiKey(
  env: NodeJS.ProcessEnv,
  secretsPath: string,
): string | undefined {
  const fromEnv = env.KIE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return loadProviderSecrets(secretsPath).kieApiKey;
}

export function resolveOpenAiApiKey(
  env: NodeJS.ProcessEnv,
  secretsPath: string,
): string | undefined {
  const fromEnv = env.OPENAI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return loadProviderSecrets(secretsPath).openAiApiKey;
}

export function resolveOpenRouterApiKey(
  env: NodeJS.ProcessEnv,
  secretsPath: string,
): string | undefined {
  const fromEnv = env.OPENROUTER_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return loadProviderSecrets(secretsPath).openRouterApiKey;
}

export function resolveGroqApiKey(
  env: NodeJS.ProcessEnv,
  secretsPath: string,
): string | undefined {
  const fromEnv = env.GROQ_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return loadProviderSecrets(secretsPath).groqApiKey;
}

export function resolveGeminiApiKey(
  env: NodeJS.ProcessEnv,
  secretsPath: string,
): string | undefined {
  const fromEnv = env.GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return loadProviderSecrets(secretsPath).geminiApiKey;
}

export function resolveOpenCodeApiKey(
  env: NodeJS.ProcessEnv,
  secretsPath: string,
): string | undefined {
  const fromEnv = env.OPENCODE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return loadProviderSecrets(secretsPath).openCodeApiKey;
}

export function resolveCompatibleApiKey(
  provider: CompatibleExecutionProvider,
  env: NodeJS.ProcessEnv,
  secretsPath: string,
): string | undefined {
  switch (provider) {
    case "openrouter":
      return resolveOpenRouterApiKey(env, secretsPath);
    case "groq":
      return resolveGroqApiKey(env, secretsPath);
    case "google":
      return resolveGeminiApiKey(env, secretsPath);
    case "opencode":
      return resolveOpenCodeApiKey(env, secretsPath);
  }
}
