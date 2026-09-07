import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { findRepositoryRoot, moduleDirectory } from "./local-runtime-config.js";
import { ChatError } from "../core/errors.js";
import { DEFAULT_RUNTIME_BUDGETS, parseRuntimePreferences, RUNTIME_BUDGET_FIELDS,
  type RuntimePreferences, type RuntimePreferencesSnapshot } from "../core/runtime-preferences.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** One local, global settings owner; never stores settings in project knowledge. */
export class RuntimePreferencesStore {
  readonly path: string | null;
  readonly #defaults: RuntimePreferences;
  readonly #operation = new AsyncLocalStorage<RuntimePreferences>();
  #volatile: RuntimePreferences | undefined;

  constructor(env: NodeJS.ProcessEnv, providerTimeoutMs: number) {
    const configured = env.A008_SETTINGS_PATH?.trim();
    this.path = configured === ":memory:" ? null : resolve(configured || join(homedir(), ".a008", "settings.json"));
    if (this.path !== null) {
      const repo = findRepositoryRoot(moduleDirectory(import.meta.url));
      const within = relative(repo, this.path);
      if (within === "" || (!within.startsWith("..") && !isAbsolute(within))) {
        throw new ChatError("configuration", "A008_SETTINGS_PATH must be outside the A008 repository.");
      }
    }
    this.#defaults = parseRuntimePreferences({ instructions: "", budgets: { ...DEFAULT_RUNTIME_BUDGETS, providerTimeoutMs } });
    this.snapshot(); // Refuse corrupt configuration before opening a provider/store.
  }

  snapshot(): RuntimePreferencesSnapshot {
    let settings = this.#volatile ?? this.#defaults;
    let raw = JSON.stringify(settings);
    if (this.path !== null && existsSync(this.path)) {
      try {
        raw = readFileSync(this.path, "utf8");
        const stored = JSON.parse(raw) as { version?: unknown; settings?: unknown };
        if (stored.version !== 1 && stored.version !== 2) throw new Error("version");
        if (stored.version === 1) {
          const legacy = stored.settings as RuntimePreferences;
          const added = ["maximumToolCalls", "maximumToolDefinitions", "toolOutputBytes", "toolTimeoutMs"] as const;
          if (!legacy?.budgets || Object.keys(legacy.budgets).length !== RUNTIME_BUDGET_FIELDS.length - added.length || added.some(k => k in legacy.budgets)) throw new Error("legacy budgets");
          settings = parseRuntimePreferences({ ...legacy, budgets: { ...Object.fromEntries(added.map(k => [k, DEFAULT_RUNTIME_BUDGETS[k]])), ...legacy.budgets } });
        } else settings = parseRuntimePreferences(stored.settings);
      } catch {
        throw new ChatError("configuration", "Cannot read A008 global settings. Expected a valid version 1 or 2 settings file at A008_SETTINGS_PATH.");
      }
    }
    return { revision: digest(raw), settings: parseRuntimePreferences(settings),
      defaults: parseRuntimePreferences(this.#defaults), fields: RUNTIME_BUDGET_FIELDS.map(f => ({ ...f })), storagePath: this.path };
  }

  save(value: unknown, revision: string): RuntimePreferencesSnapshot {
    const settings = parseRuntimePreferences(value);
    let lock: number | undefined;
    let temporary: string | undefined;
    try {
      if (this.path !== null) {
        mkdirSync(dirname(this.path), { recursive: true });
        try { lock = openSync(`${this.path}.lock`, "wx", 0o600); }
        catch { throw new ChatError("configuration", "Global settings are being saved by another process. Retry after it finishes."); }
      }
      if (this.snapshot().revision !== revision) {
        throw new ChatError("configuration", "Global settings changed elsewhere. Reload saved settings before saving again.");
      }
      if (this.path === null) this.#volatile = settings;
      else {
        temporary = `${this.path}.${randomUUID()}.tmp`;
        writeFileSync(temporary, JSON.stringify({ version: 2, settings }, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
        renameSync(temporary, this.path);
        temporary = undefined;
      }
      return this.snapshot();
    } finally {
      // Cleanup must not mask a failed write or strand our lock if no temp file
      // was created (for example when the disk is full).
      try { if (temporary !== undefined && existsSync(temporary)) unlinkSync(temporary); }
      finally {
        if (lock !== undefined) {
          try { closeSync(lock); } finally { unlinkSync(`${this.path}.lock`); }
        }
      }
    }
  }

  get current(): RuntimePreferences { return this.#operation.getStore() ?? this.snapshot().settings; }
  run<T>(operation: () => T): T {
    return this.#operation.run(this.snapshot().settings, operation);
  }
}
