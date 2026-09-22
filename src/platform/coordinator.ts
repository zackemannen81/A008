import { randomUUID } from "node:crypto";
import { readProjectRegistry } from "../bootstrap/registry.js";
import type { RegisteredProject } from "../bootstrap/types.js";
import { ProjectRuntimeRegistry } from "../engine/project-runtime-registry.js";
import { DeviceRegistry } from "../gui-host/device-registry.js";
import {
  defaultSqlitePath,
  PROJECT_ID_ENV,
  SQLITE_PATH_ENV,
} from "../runtime/local-runtime-config.js";
import type { LocalMemorySession } from "../runtime/local-memory-runtime.js";
import { RuntimeOwnershipError, acquireRuntimeLease } from "../runtime/runtime-ownership.js";
import { ChatError } from "../core/errors.js";
import {
  PLATFORM_LOCAL_OWNER_PRINCIPAL_ID,
  type PlatformLocalConfig,
} from "./local-config.js";
import { PlatformStore, PlatformStoreError } from "./platform-store.js";
import {
  completePlatformTextTurn,
  openPlatformTextSession,
  platformModelAvailable,
  type PlatformTextHistoryMessage,
} from "./runtime-adapter.js";
import type { PlatformRun, PlatformScope } from "./types.js";

const ACTIVE_STATUSES = ["running", "cancel_requested"] as const;

export interface PlatformBackend {
  readonly config: PlatformLocalConfig;
  readonly store: PlatformStore;
  readonly coordinator: PlatformCoordinator;
  close(): Promise<void>;
}

export function openPlatformBackend(options: {
  readonly config: PlatformLocalConfig;
  readonly registry: ProjectRuntimeRegistry;
  readonly projectsPath: string;
  readonly env: NodeJS.ProcessEnv;
  readonly devices: DeviceRegistry;
  readonly pinEnabled: () => boolean;
  readonly stderr?: NodeJS.WritableStream;
}): PlatformBackend {
  let release: (() => void) | undefined;
  let store: PlatformStore | undefined;
  try {
    release = acquireRuntimeLease(options.config.path, "platform");
    store = new PlatformStore({ filename: options.config.path });
    const coordinator = new PlatformCoordinator({
      store,
      config: options.config,
      registry: options.registry,
      projectsPath: options.projectsPath,
      env: options.env,
      devices: options.devices,
      pinEnabled: options.pinEnabled,
      ...(options.stderr === undefined ? {} : { stderr: options.stderr }),
    });
    coordinator.start();
    const opened = store;
    const unlock = release;
    let closed = false;
    return {
      config: options.config,
      store: opened,
      coordinator,
      async close() {
        if (closed) return;
        closed = true;
        try {
          await coordinator.stop();
        } finally {
          opened.close();
          unlock();
        }
      },
    };
  } catch (error) {
    store?.close();
    release?.();
    if (error instanceof RuntimeOwnershipError) {
      throw new ChatError(
        "configuration",
        "The platform database already has an exclusive process owner.",
      );
    }
    throw error;
  }
}

export class PlatformCoordinator {
  readonly #store: PlatformStore;
  readonly #config: PlatformLocalConfig;
  readonly #registry: ProjectRuntimeRegistry;
  readonly #projectsPath: string;
  readonly #env: NodeJS.ProcessEnv;
  readonly #devices: DeviceRegistry;
  readonly #pinEnabled: () => boolean;
  readonly #stderr: NodeJS.WritableStream | undefined;
  readonly #ownerToken = `platform:${randomUUID()}`;
  readonly #shutdown = new AbortController();
  readonly #active = new Set<Promise<void>>();
  #queue: Promise<void> = Promise.resolve();
  #stopped = false;
  #started = false;
  #wake: (() => void) | undefined;
  #loop: Promise<void> | undefined;

  constructor(options: {
    readonly store: PlatformStore;
    readonly config: PlatformLocalConfig;
    readonly registry: ProjectRuntimeRegistry;
    readonly projectsPath: string;
    readonly env: NodeJS.ProcessEnv;
    readonly devices: DeviceRegistry;
    readonly pinEnabled: () => boolean;
    readonly stderr?: NodeJS.WritableStream;
  }) {
    this.#store = options.store;
    this.#config = options.config;
    this.#registry = options.registry;
    this.#projectsPath = options.projectsPath;
    this.#env = options.env;
    this.#devices = options.devices;
    this.#pinEnabled = options.pinEnabled;
    this.#stderr = options.stderr;
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#loop = this.#runLoop();
  }

  kick(): void {
    this.#wake?.();
  }

  admit<T>(work: () => T): Promise<T> {
    const run = this.#queue.then(() => work());
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  countNonterminal(projectId?: string): number {
    return this.#projectRuns(projectId).filter((run) => !isTerminal(run.status)).length;
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    this.#shutdown.abort();
    this.kick();
    await this.#loop?.catch(() => undefined);
    const drain = this.#config.shutdownDrainMs;
    await Promise.race([
      Promise.allSettled([...this.#active]),
      new Promise<void>((resolve) => setTimeout(resolve, drain)),
    ]);
  }

  async #runLoop(): Promise<void> {
    while (!this.#stopped) {
      try {
        await this.#tick();
      } catch (error) {
        this.#note(error);
      }
      if (this.#stopped) break;
      await this.#pause();
    }
  }

  async #tick(): Promise<void> {
    await this.admit(() => {
      this.#recover();
    });
    await this.#dispatchAvailable();
  }

  #recover(): void {
    for (const scope of this.#scopes()) {
      try {
        this.#store.recoverExpiredLeases(scope);
      } catch (error) {
        this.#note(error);
      }
      let runs: readonly PlatformRun[] = [];
      try {
        runs = this.#store.listRuns(scope);
      } catch (error) {
        this.#note(error);
        continue;
      }
      for (const run of runs) {
        if (run.answerStatus !== "completed" || run.memoryStatus !== "pending") {
          continue;
        }
        try {
          this.#store.recordMemoryOutcome(scope, {
            runId: run.id,
            expectedRevision: run.revision,
            status: "unknown",
          });
        } catch (error) {
          this.#note(error);
        }
      }
    }
  }

  async #dispatchAvailable(): Promise<void> {
    const skipped = new Set<string>();
    for (;;) {
      if (this.#stopped) return;
      const started = await this.admit(() => this.#claimNext(skipped));
      if (!started) return;
    }
  }

  #claimNext(skipped: Set<string>): boolean {
    if (this.#stopped) return false;
    if (this.#activeCount() >= this.#config.maxActiveRuns) return false;
    const candidates = this.#queued().filter((candidate) => !skipped.has(candidate.run.id));
    for (const candidate of candidates) {
      const { scope, run } = candidate;
      if (!this.#canDispatch(scope.principalId, scope.projectId)) {
        skipped.add(run.id);
        continue;
      }
      if (!platformModelAvailable(this.#env, run.model)) {
        this.#failQueued(
          scope,
          run,
          "INVALID_REQUEST",
          "The registered model is no longer available.",
        );
        return true;
      }
      const project = this.#project(scope.projectId);
      if (project === undefined) {
        skipped.add(run.id);
        continue;
      }
      let runtime;
      try {
        runtime = this.#registry.openConfigured(
          project.rootFolder,
          this.#projectEnv(project),
        ).runtime;
        runtime.sessionParameters(run.model);
      } catch (error) {
        if (error instanceof ChatError && error.code === "unknown_model") {
          this.#failQueued(
            scope,
            run,
            "INVALID_REQUEST",
            "The registered model is no longer available.",
          );
          return true;
        }
        this.#note(error);
        skipped.add(run.id);
        continue;
      }
      const prepared = this.#prepare(scope, run);
      if (prepared === undefined) {
        this.#failQueued(
          scope,
          run,
          "INVALID_REQUEST",
          "The accepted run has no text message to execute.",
        );
        return true;
      }
      let session: LocalMemorySession;
      try {
        session = openPlatformTextSession({
          runtime,
          model: run.model,
          conversationId: run.conversationId,
          history: prepared.history,
        });
      } catch (error) {
        this.#note(error);
        this.#failQueued(
          scope,
          run,
          "INTERNAL_ERROR",
          "The text run could not be prepared.",
        );
        return true;
      }
      if (this.#stopped || !this.#canDispatch(scope.principalId, scope.projectId)) {
        return false;
      }
      let claimed;
      try {
        claimed = this.#store.claimRun(scope, {
          runId: run.id,
          ownerToken: this.#ownerToken,
          leaseDurationMs: this.#config.leaseDurationMs,
        });
      } catch (error) {
        this.#note(error);
        skipped.add(run.id);
        continue;
      }
      if (claimed.run.status !== "running") return true;
      let dispatched: PlatformRun;
      try {
        dispatched = this.#store.recordDispatch(scope, {
          runId: claimed.run.id,
          ownerToken: claimed.lease.ownerToken,
          generation: claimed.lease.generation,
          expectedRevision: claimed.run.revision,
        });
      } catch (error) {
        this.#note(error);
        return true;
      }
      const work = this.#finish(
        scope,
        dispatched,
        claimed.lease.generation,
        session,
        prepared.text,
      );
      this.#active.add(work);
      void work.finally(() => this.#active.delete(work));
      return true;
    }
    return false;
  }

  async #finish(
    scope: PlatformScope,
    run: PlatformRun,
    generation: number,
    session: LocalMemorySession,
    text: string,
  ): Promise<void> {
    const abort = new AbortController();
    const onShutdown = (): void => abort.abort();
    if (this.#shutdown.signal.aborted) abort.abort();
    else this.#shutdown.signal.addEventListener("abort", onShutdown, { once: true });
    const renew = setInterval(() => {
      if (abort.signal.aborted || this.#stopped) return;
      if (!this.#canDispatch(scope.principalId, scope.projectId)) {
        abort.abort();
        return;
      }
      try {
        this.#store.renewLease(scope, {
          runId: run.id,
          ownerToken: this.#ownerToken,
          generation,
          leaseDurationMs: this.#config.leaseDurationMs,
        });
      } catch (error) {
        this.#note(error);
        abort.abort();
      }
    }, this.#config.renewIntervalMs);
    renew.unref?.();
    const timeout = setTimeout(() => abort.abort(), this.#config.turnTimeoutMs);
    timeout.unref?.();
    try {
      const outcome = await completePlatformTextTurn(session, text, abort.signal);
      clearInterval(renew);
      clearTimeout(timeout);
      if (outcome.answer === undefined) return;
      let committed: PlatformRun;
      try {
        const latest = this.#store.getRun(scope, run.id);
        if (latest.status !== "running" && latest.status !== "cancel_requested") {
          return;
        }
        committed = this.#store.commitAnswer(scope, {
          runId: run.id,
          ownerToken: this.#ownerToken,
          generation,
          expectedRevision: latest.revision,
          content: outcome.answer,
        });
      } catch (error) {
        this.#note(error);
        return;
      }
      const memoryStatus =
        outcome.memoryStatus === "completed" || outcome.memoryStatus === "failed"
          ? outcome.memoryStatus
          : "unknown";
      try {
        this.#store.recordMemoryOutcome(scope, {
          runId: committed.id,
          expectedRevision: committed.revision,
          status: memoryStatus,
        });
      } catch (error) {
        this.#note(error);
        try {
          const latest = this.#store.getRun(scope, run.id);
          if (latest.memoryStatus === "pending" && latest.answerStatus === "completed") {
            this.#store.recordMemoryOutcome(scope, {
              runId: latest.id,
              expectedRevision: latest.revision,
              status: "unknown",
            });
          }
        } catch (followUp) {
          this.#note(followUp);
        }
      }
    } finally {
      clearInterval(renew);
      clearTimeout(timeout);
      this.#shutdown.signal.removeEventListener("abort", onShutdown);
    }
  }

  #prepare(
    scope: PlatformScope,
    run: PlatformRun,
  ): { readonly text: string; readonly history: readonly PlatformTextHistoryMessage[] } | undefined {
    const conversation = this.#store.getConversation(scope, run.conversationId);
    const own = conversation.messages.find(
      (message) => message.runId === run.id && message.role === "user",
    );
    if (own === undefined || typeof own.content !== "string" || own.content.length === 0) {
      return undefined;
    }
    const history: PlatformTextHistoryMessage[] = [];
    for (const message of conversation.messages) {
      if (message.runId === run.id) continue;
      if (message.role !== "user" && message.role !== "assistant") continue;
      history.push({ role: message.role, content: message.content });
    }
    return { text: own.content, history };
  }

  #failQueued(
    scope: PlatformScope,
    run: PlatformRun,
    code: string,
    message: string,
  ): void {
    try {
      const claimed = this.#store.claimRun(scope, {
        runId: run.id,
        ownerToken: this.#ownerToken,
        leaseDurationMs: this.#config.leaseDurationMs,
      });
      this.#store.failRun(scope, {
        runId: run.id,
        ownerToken: this.#ownerToken,
        generation: claimed.lease.generation,
        expectedRevision: claimed.run.revision,
        error: { code, message },
      });
    } catch (error) {
      this.#note(error);
    }
  }

  #queued(): { readonly scope: PlatformScope; readonly run: PlatformRun }[] {
    const queued = this.#projectRuns(undefined, ["queued"]).map((run) => ({
      scope: {
        tenantId: this.#config.tenantId,
        projectId: run.projectId,
        principalId: run.principalId,
      },
      run,
    }));
    queued.sort((left, right) => {
      if (left.run.createdAt !== right.run.createdAt) {
        return left.run.createdAt - right.run.createdAt;
      }
      return left.run.id < right.run.id ? -1 : 1;
    });
    return queued;
  }

  #activeCount(): number {
    return this.#projectRuns(undefined, ACTIVE_STATUSES).length;
  }

  /**
   * Run rows are project-scoped. Listing once per project avoids counting the
   * same run under every known principal.
   */
  #projectRuns(
    projectId: string | undefined,
    statuses?: readonly PlatformRun["status"][],
  ): PlatformRun[] {
    const runs: PlatformRun[] = [];
    const seen = new Set<string>();
    for (const project of this.#projects()) {
      if (projectId !== undefined && project.projectId !== projectId) continue;
      const scope: PlatformScope = {
        tenantId: this.#config.tenantId,
        projectId: project.projectId,
        principalId: PLATFORM_LOCAL_OWNER_PRINCIPAL_ID,
      };
      try {
        for (const run of this.#store.listRuns(
          scope,
          statuses === undefined ? {} : { statuses },
        )) {
          if (seen.has(run.id)) continue;
          seen.add(run.id);
          runs.push(run);
        }
      } catch (error) {
        this.#note(error);
      }
    }
    return runs;
  }

  #scopes(projectId?: string): PlatformScope[] {
    const projects = this.#projects().filter(
      (project) => projectId === undefined || project.projectId === projectId,
    );
    const scopes: PlatformScope[] = [];
    for (const project of projects) {
      for (const principalId of this.#principalIds()) {
        scopes.push({
          tenantId: this.#config.tenantId,
          projectId: project.projectId,
          principalId,
        });
      }
    }
    return scopes;
  }

  #principalIds(): readonly string[] {
    const ids = new Set<string>([PLATFORM_LOCAL_OWNER_PRINCIPAL_ID]);
    try {
      for (const device of this.#devices.list()) ids.add(device.id);
    } catch (error) {
      this.#note(error);
    }
    return [...ids];
  }

  #projects(): readonly RegisteredProject[] {
    try {
      return readProjectRegistry(this.#projectsPath).projects;
    } catch (error) {
      this.#note(error);
      return [];
    }
  }

  #project(projectId: string): RegisteredProject | undefined {
    return this.#projects().find((project) => project.projectId === projectId);
  }

  #canDispatch(principalId: string, projectId: string): boolean {
    if (this.#project(projectId) === undefined) return false;
    if (principalId === PLATFORM_LOCAL_OWNER_PRINCIPAL_ID) return this.#pinEnabled();
    const device = this.#devices.current(principalId);
    if (device === undefined) return false;
    return (
      device.capabilities.includes("session") &&
      device.projects.includes(projectId)
    );
  }

  #projectEnv(project: RegisteredProject): NodeJS.ProcessEnv {
    const sqlite = project.memory.useGlobalA008Memory
      ? (this.#env[SQLITE_PATH_ENV]?.trim() || defaultSqlitePath())
      : ":memory:";
    if (sqlite !== ":memory:" && sameFile(sqlite, this.#config.path)) {
      throw new ChatError(
        "configuration",
        "Project memory storage must stay distinct from the platform database.",
      );
    }
    return {
      ...this.#env,
      [PROJECT_ID_ENV]: project.projectId,
      [SQLITE_PATH_ENV]: sqlite,
    };
  }

  #pause(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, this.#config.scanIntervalMs);
      timer.unref?.();
      this.#wake = () => {
        clearTimeout(timer);
        this.#wake = undefined;
        resolve();
      };
    });
  }

  #note(error: unknown): void {
    if (this.#stderr === undefined) return;
    const message =
      error instanceof PlatformStoreError || error instanceof Error
        ? error.message
        : "scan failed";
    this.#stderr.write(`platform coordinator: ${message}\n`);
  }
}

function isTerminal(status: PlatformRun["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

function sameFile(left: string, right: string): boolean {
  if (process.platform === "win32") return left.toLowerCase() === right.toLowerCase();
  return left === right;
}
