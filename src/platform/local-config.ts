import { existsSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { ChatError } from "../core/errors.js";
import { assertPathOutsideRepo } from "../core/user-catalog.js";
import { defaultSqlitePath } from "../runtime/local-runtime-config.js";
import { canonicalStoragePath } from "../runtime/runtime-ownership.js";

/** Server-issued browser principal. Valid only while the host PIN profile is enabled. */
export const PLATFORM_LOCAL_OWNER_PRINCIPAL_ID = "owner_browser";
export const PLATFORM_LOCAL_TENANT_ID = "local";
export const PLATFORM_PATH_ENV = "A008_PLATFORM_PATH";
export const PLATFORM_MAX_ACTIVE_RUNS_ENV = "A008_PLATFORM_MAX_ACTIVE_RUNS";
export const PLATFORM_MAX_NONTERMINAL_PER_PROJECT_ENV =
  "A008_PLATFORM_MAX_NONTERMINAL_PER_PROJECT";
export const PLATFORM_MAX_NONTERMINAL_ENV = "A008_PLATFORM_MAX_NONTERMINAL";
export const PLATFORM_LEASE_MS_ENV = "A008_PLATFORM_LEASE_MS";
export const PLATFORM_RENEW_MS_ENV = "A008_PLATFORM_RENEW_MS";
export const PLATFORM_TURN_TIMEOUT_MS_ENV = "A008_PLATFORM_TURN_TIMEOUT_MS";
export const PLATFORM_SHUTDOWN_DRAIN_MS_ENV =
  "A008_PLATFORM_SHUTDOWN_DRAIN_MS";
export const PLATFORM_SCAN_MS_ENV = "A008_PLATFORM_SCAN_MS";
export const PLATFORM_MAX_RESPONSE_BYTES_ENV =
  "A008_PLATFORM_MAX_RESPONSE_BYTES";

export const PLATFORM_DEFAULT_MAX_ACTIVE_RUNS = 4;
export const PLATFORM_DEFAULT_MAX_NONTERMINAL_PER_PROJECT = 100;
export const PLATFORM_DEFAULT_MAX_NONTERMINAL = 256;
export const PLATFORM_DEFAULT_LEASE_MS = 30_000;
export const PLATFORM_DEFAULT_RENEW_MS = 5_000;
export const PLATFORM_DEFAULT_TURN_TIMEOUT_MS = 120_000;
export const PLATFORM_DEFAULT_SHUTDOWN_DRAIN_MS = 10_000;
export const PLATFORM_DEFAULT_SCAN_MS = 1_000;
export const PLATFORM_MAX_JSON_BODY_BYTES = 1_048_576;
export const PLATFORM_MAX_PROMPT_BYTES = 65_536;
export const PLATFORM_MAX_RESPONSE_BYTES = 8_388_608;

export interface PlatformLocalConfig {
  readonly path: string;
  readonly tenantId: typeof PLATFORM_LOCAL_TENANT_ID;
  readonly maxActiveRuns: number;
  readonly maxNonterminalPerProject: number;
  readonly maxNonterminal: number;
  readonly leaseDurationMs: number;
  readonly renewIntervalMs: number;
  readonly turnTimeoutMs: number;
  readonly shutdownDrainMs: number;
  readonly scanIntervalMs: number;
  readonly maxJsonBodyBytes: number;
  readonly maxPromptBytes: number;
  readonly maxResponseBytes: number;
}

/**
 * Opt-in platform file. Undefined leaves `/v3/info` unavailable and opens no database.
 * A configured path must be an absolute canonical file outside the repository and
 * distinct from semantic-memory storage.
 */
export function resolvePlatformLocalConfig(options: {
  readonly platformPath?: string;
  readonly env: NodeJS.ProcessEnv;
  readonly repoRoot: string;
}): PlatformLocalConfig | undefined {
  const requested = options.platformPath ?? options.env[PLATFORM_PATH_ENV];
  const raw = requested?.trim() ?? "";
  if (raw.length === 0) return undefined;
  if (!isAbsolute(raw)) {
    throw new ChatError(
      "configuration",
      "A008_PLATFORM_PATH must be an absolute file path.",
    );
  }
  let path: string;
  try {
    path = canonicalStoragePath(raw);
  } catch {
    throw new ChatError(
      "configuration",
      "A008_PLATFORM_PATH must be a file in an existing directory.",
    );
  }
  if (existsSync(path) && statSync(path).isDirectory()) {
    throw new ChatError(
      "configuration",
      "A008_PLATFORM_PATH must be a file, not a directory.",
    );
  }
  assertPathOutsideRepo(path, options.repoRoot, "A008_PLATFORM_PATH");
  const memoryPath = configuredMemoryPath(options.env);
  if (memoryPath !== undefined && samePath(path, memoryPath)) {
    throw new ChatError(
      "configuration",
      "A008_PLATFORM_PATH must be distinct from semantic memory storage.",
    );
  }
  const maxActiveRuns = boundedInt(
    options.env[PLATFORM_MAX_ACTIVE_RUNS_ENV],
    PLATFORM_DEFAULT_MAX_ACTIVE_RUNS,
    1,
    32,
    PLATFORM_MAX_ACTIVE_RUNS_ENV,
  );
  const maxNonterminalPerProject = boundedInt(
    options.env[PLATFORM_MAX_NONTERMINAL_PER_PROJECT_ENV],
    PLATFORM_DEFAULT_MAX_NONTERMINAL_PER_PROJECT,
    1,
    PLATFORM_DEFAULT_MAX_NONTERMINAL_PER_PROJECT,
    PLATFORM_MAX_NONTERMINAL_PER_PROJECT_ENV,
  );
  const maxNonterminal = boundedInt(
    options.env[PLATFORM_MAX_NONTERMINAL_ENV],
    PLATFORM_DEFAULT_MAX_NONTERMINAL,
    1,
    PLATFORM_DEFAULT_MAX_NONTERMINAL,
    PLATFORM_MAX_NONTERMINAL_ENV,
  );
  const leaseDurationMs = boundedInt(
    options.env[PLATFORM_LEASE_MS_ENV],
    PLATFORM_DEFAULT_LEASE_MS,
    50,
    300_000,
    PLATFORM_LEASE_MS_ENV,
  );
  const renewIntervalMs = boundedInt(
    options.env[PLATFORM_RENEW_MS_ENV],
    PLATFORM_DEFAULT_RENEW_MS,
    10,
    60_000,
    PLATFORM_RENEW_MS_ENV,
  );
  const turnTimeoutMs = boundedInt(
    options.env[PLATFORM_TURN_TIMEOUT_MS_ENV],
    PLATFORM_DEFAULT_TURN_TIMEOUT_MS,
    50,
    PLATFORM_DEFAULT_TURN_TIMEOUT_MS,
    PLATFORM_TURN_TIMEOUT_MS_ENV,
  );
  const shutdownDrainMs = boundedInt(
    options.env[PLATFORM_SHUTDOWN_DRAIN_MS_ENV],
    PLATFORM_DEFAULT_SHUTDOWN_DRAIN_MS,
    0,
    PLATFORM_DEFAULT_TURN_TIMEOUT_MS,
    PLATFORM_SHUTDOWN_DRAIN_MS_ENV,
  );
  const scanIntervalMs = boundedInt(
    options.env[PLATFORM_SCAN_MS_ENV],
    PLATFORM_DEFAULT_SCAN_MS,
    10,
    60_000,
    PLATFORM_SCAN_MS_ENV,
  );
  const maxResponseBytes = boundedInt(
    options.env[PLATFORM_MAX_RESPONSE_BYTES_ENV],
    PLATFORM_MAX_RESPONSE_BYTES,
    1,
    PLATFORM_MAX_RESPONSE_BYTES,
    PLATFORM_MAX_RESPONSE_BYTES_ENV,
  );
  if (renewIntervalMs >= leaseDurationMs) {
    throw new ChatError(
      "configuration",
      "A008_PLATFORM_RENEW_MS must be less than A008_PLATFORM_LEASE_MS.",
    );
  }
  if (
    maxActiveRuns > maxNonterminal ||
    maxNonterminalPerProject > maxNonterminal
  ) {
    throw new ChatError(
      "configuration",
      "Platform active and per-project limits cannot exceed the backend nonterminal limit.",
    );
  }
  return {
    path,
    tenantId: PLATFORM_LOCAL_TENANT_ID,
    maxActiveRuns,
    maxNonterminalPerProject,
    maxNonterminal,
    leaseDurationMs,
    renewIntervalMs,
    turnTimeoutMs,
    shutdownDrainMs,
    scanIntervalMs,
    maxJsonBodyBytes: PLATFORM_MAX_JSON_BODY_BYTES,
    maxPromptBytes: PLATFORM_MAX_PROMPT_BYTES,
    maxResponseBytes,
  };
}

function boundedInt(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (raw === undefined || raw.trim().length === 0) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ChatError(
      "configuration",
      `${label} must be an integer from ${minimum} through ${maximum}.`,
    );
  }
  return value;
}

function configuredMemoryPath(env: NodeJS.ProcessEnv): string | undefined {
  const configured = env.A008_MEMORY_SQLITE_PATH?.trim();
  const selected =
    configured === undefined || configured.length === 0
      ? defaultSqlitePath()
      : configured === ":memory:"
        ? undefined
        : configured;
  if (selected === undefined) return undefined;
  try {
    return canonicalStoragePath(selected);
  } catch {
    return undefined;
  }
}

function samePath(left: string, right: string): boolean {
  if (process.platform === "win32") {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}
