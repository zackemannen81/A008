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
}

export function defaultSqlitePath(): string {
  return join(homedir(), ".A008", "memory.sqlite");
}

export function findRepositoryRoot(startDirectory: string): string {
  let current = resolve(startDirectory);
  while (true) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "AGENTS.md"))
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
  };
}

export function projectIdSidecarPath(sqlitePath: string): string {
  return join(dirname(sqlitePath), PROJECT_ID_SIDECAR);
}
