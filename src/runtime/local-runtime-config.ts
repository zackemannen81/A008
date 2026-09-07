import { existsSync } from "node:fs";
import { homedir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { ChatError } from "../core/errors.js";
import type { DebugTraceMode } from "./debug-trace.js";

export const PROJECT_ID_ENV = "A008_PROJECT_ID";
export const AGENT_ID_ENV = "A008_AGENT_ID";
export const SQLITE_PATH_ENV = "A008_MEMORY_SQLITE_PATH";
export const DEBUG_TRACE_ENV = "A008_DEBUG_TRACE";
export const DEBUG_TRACE_FILE_ENV = "A008_DEBUG_TRACE_FILE";
export const SOURCE_STORE_PATH_ENV = "A008_SOURCE_STORE_PATH";
export const PROVIDER_TIMEOUT_ENV = "A008_PROVIDER_TIMEOUT_MS";
export const CHAT_TEMPERATURE_ENV = "A008_CHAT_TEMPERATURE";
export const CHAT_TOP_P_ENV = "A008_CHAT_TOP_P";
export const CHAT_MAX_TOKENS_ENV = "A008_CHAT_MAX_TOKENS";
export const CHAT_REASONING_BUDGET_ENV = "A008_CHAT_REASONING_BUDGET";
export const CHAT_THINKING_ENV = "A008_CHAT_THINKING";

/**
 * Default per-request ceiling for a provider call.
 *
 * The adapter's own default is 60 seconds, which was fine when a semantic call
 * asked for a handful of proposals. A008-0046 raised the staging ceiling to 128
 * and A008-0047 asks the model for completeness, so a single extraction is now
 * a long generation: an owner-observed run of this exact workload took 87
 * seconds in the provider playground and timed out here. 180 seconds is a
 * ceiling rather than a target.
 */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 180_000;
export const PROJECT_ID_SIDECAR = "A008-project-id";

export interface LocalRuntimeCliTraceOptions {
  readonly debugTrace?: string;
  readonly debugTraceFile?: string;
}

export interface LocalRuntimeConfig {
  readonly projectId: string | undefined;
  readonly agentId: string | undefined;
  readonly sqlitePath: string;
  readonly sqliteIsMemory: boolean;
  readonly debugTrace: DebugTraceMode;
  readonly debugTraceFile: string | undefined;
  /** Undefined when `A008_SOURCE_STORE_PATH` is not set: source ingest is off. */
  readonly sourceStorePath: string | undefined;
  readonly providerTimeoutMs: number;
  /**
   * Overrides applied over the verified model profile's generation defaults.
   *
   * The profile ships `reasoningBudget: 16384` against `maxTokens: 16384`, so
   * reasoning can consume the whole output budget and truncate the answer.
   * These let that be tuned without editing a profile that means "checked
   * against the model card". Empty unless an operator sets one.
   */
  readonly chatGeneration: ChatGenerationOverrides;
}

export interface ChatGenerationOverrides {
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly reasoningBudget?: number;
  readonly enableThinking?: boolean;
}

function boundedNumber(
  raw: string | undefined,
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new ChatError(
      "configuration",
      `${name} must be a number between ${String(minimum)} and ${String(maximum)}.`,
    );
  }
  return parsed;
}

function positiveInteger(
  raw: string | undefined,
  name: string,
): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ChatError(
      "configuration",
      `${name} must be a positive whole number.`,
    );
  }
  return parsed;
}

function booleanFlag(raw: string | undefined, name: string): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "on" || normalized === "true") {
    return true;
  }
  if (normalized === "off" || normalized === "false") {
    return false;
  }
  throw new ChatError("configuration", `${name} must be on or off.`);
}

function resolvedChatGeneration(
  env: NodeJS.ProcessEnv,
): ChatGenerationOverrides {
  const temperature = boundedNumber(
    optionalText(env, CHAT_TEMPERATURE_ENV),
    CHAT_TEMPERATURE_ENV,
    0,
    2,
  );
  const topP = boundedNumber(optionalText(env, CHAT_TOP_P_ENV), CHAT_TOP_P_ENV, 0, 1);
  const maxTokens = positiveInteger(
    optionalText(env, CHAT_MAX_TOKENS_ENV),
    CHAT_MAX_TOKENS_ENV,
  );
  const reasoningBudget = positiveInteger(
    optionalText(env, CHAT_REASONING_BUDGET_ENV),
    CHAT_REASONING_BUDGET_ENV,
  );
  const enableThinking = booleanFlag(
    optionalText(env, CHAT_THINKING_ENV),
    CHAT_THINKING_ENV,
  );
  return {
    ...(temperature === undefined ? {} : { temperature }),
    ...(topP === undefined ? {} : { topP }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(reasoningBudget === undefined ? {} : { reasoningBudget }),
    ...(enableThinking === undefined ? {} : { enableThinking }),
  };
}

export function defaultSqlitePath(): string {
  return join(homedir(), ".A008", "memory.sqlite");
}

export function findRepositoryRoot(startDirectory: string): string {
  let current = resolve(startDirectory);
  while (true) {
    if (
      existsSync(join(current, "package.json")) &&
      (existsSync(join(current, "AGENTS.md")) || existsSync(join(current, "agent007.brain.json")))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new ChatError(
        "configuration",
        "Unable to locate the A008 repository root.",
      );
    }
    current = parent;
  }
}

export function moduleDirectory(moduleUrl: string): string {
  return dirname(fileURLToPath(moduleUrl));
}

export function parseDebugTraceMode(value: string | undefined): DebugTraceMode {
  const normalized = (value ?? "off").trim().toLowerCase();
  if (normalized === "off" || normalized === "safe" || normalized === "raw") {
    return normalized;
  }
  throw new ChatError(
    "configuration",
    "A008_DEBUG_TRACE must be off, safe, or raw.",
  );
}

function optionalText(
  env: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function resolvedSqlitePath(raw: string, repositoryRoot: string): string {
  if (raw === ":memory:") {
    return raw;
  }
  const resolved = isAbsolute(raw) ? resolve(raw) : resolve(process.cwd(), raw);
  const relativeToRepo = relative(repositoryRoot, resolved);
  if (
    relativeToRepo === "" ||
    (!relativeToRepo.startsWith("..") && !isAbsolute(relativeToRepo))
  ) {
    throw new ChatError(
      "configuration",
      "A008_MEMORY_SQLITE_PATH must be outside the A008 repository.",
    );
  }
  return resolved;
}

/**
 * Validates `A008_SOURCE_STORE_PATH` exactly as {@link resolvedSqlitePath}
 * validates `A008_MEMORY_SQLITE_PATH`: resolved to an absolute path and
 * rejected when it lands inside the A008 repository. Returned `undefined`
 * when unset, which callers treat as "source ingest is not configured".
 */
function resolvedProviderTimeout(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000) {
    throw new ChatError(
      "configuration",
      `${PROVIDER_TIMEOUT_ENV} must be a whole number of milliseconds, at least 1000.`,
    );
  }
  return parsed;
}

function resolvedSourceStorePath(
  raw: string | undefined,
  repositoryRoot: string,
): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const resolved = isAbsolute(raw) ? resolve(raw) : resolve(process.cwd(), raw);
  const relativeToRepo = relative(repositoryRoot, resolved);
  if (
    relativeToRepo === "" ||
    (!relativeToRepo.startsWith("..") && !isAbsolute(relativeToRepo))
  ) {
    throw new ChatError(
      "configuration",
      "A008_SOURCE_STORE_PATH must be outside the A008 repository.",
    );
  }
  return resolved;
}

function resolvedTraceFile(
  raw: string | undefined,
  mode: DebugTraceMode,
  surface: "cli" | "acp",
): string | undefined {
  if (mode === "off") {
    return undefined;
  }
  if (raw === undefined) {
    if (mode === "raw") {
      throw new ChatError(
        "configuration",
        "A008_DEBUG_TRACE_FILE must be an absolute path when raw tracing is enabled.",
      );
    }
    if (surface === "acp") {
      throw new ChatError(
        "configuration",
        "A008_DEBUG_TRACE_FILE must be an absolute path when ACP tracing is enabled.",
      );
    }
    return undefined;
  }
  if (!isAbsolute(raw)) {
    throw new ChatError(
      "configuration",
      "A008_DEBUG_TRACE_FILE must be an absolute path.",
    );
  }
  return resolve(raw);
}

export function parseLocalRuntimeConfig(
  env: NodeJS.ProcessEnv,
  options: {
    readonly surface: "cli" | "acp";
    readonly cli?: LocalRuntimeCliTraceOptions;
    readonly repositoryRoot?: string;
  },
): LocalRuntimeConfig {
  const repositoryRoot =
    options.repositoryRoot ??
    findRepositoryRoot(moduleDirectory(import.meta.url));
  const sqliteRaw =
    optionalText(env, SQLITE_PATH_ENV) ?? defaultSqlitePath();
  const mode = parseDebugTraceMode(
    options.cli?.debugTrace ?? optionalText(env, DEBUG_TRACE_ENV),
  );
  const fileRaw =
    options.cli?.debugTraceFile ?? optionalText(env, DEBUG_TRACE_FILE_ENV);
  const sourceStoreRaw = optionalText(env, SOURCE_STORE_PATH_ENV);

  return {
    projectId: optionalText(env, PROJECT_ID_ENV),
    agentId: optionalText(env, AGENT_ID_ENV),
    sqlitePath: resolvedSqlitePath(sqliteRaw, repositoryRoot),
    sqliteIsMemory: sqliteRaw === ":memory:",
    debugTrace: mode,
    debugTraceFile: resolvedTraceFile(fileRaw, mode, options.surface),
    sourceStorePath: resolvedSourceStorePath(sourceStoreRaw, repositoryRoot),
    providerTimeoutMs: resolvedProviderTimeout(
      optionalText(env, PROVIDER_TIMEOUT_ENV),
    ),
    chatGeneration: resolvedChatGeneration(env),
  };
}

export function projectIdSidecarPath(sqlitePath: string): string {
  return join(dirname(sqlitePath), PROJECT_ID_SIDECAR);
}
