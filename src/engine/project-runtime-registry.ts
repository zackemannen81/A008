import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { createAcpRuntime } from "../acp/server.js";
import { parseRuntimeId } from "../identity/runtime-id.js";
import {
  parseLocalRuntimeConfig,
  projectIdSidecarPath,
} from "../runtime/local-runtime-config.js";
import {
  acquireRuntimeLease,
  canonicalStoragePath as storagePath,
} from "../runtime/runtime-ownership.js";

export interface ExistingProjectAttachment {
  readonly cwd: string;
  readonly projectId: string;
  readonly sqlitePath: string;
  readonly sourceStorePath?: string;
}
export interface ProjectRuntimeBinding {
  readonly cwd: string;
  readonly projectId: string;
  readonly sqlitePath: string;
  readonly sourceStorePath?: string;
}
export type ProjectRuntime = ReturnType<typeof createAcpRuntime> & {
  readonly cwd: string;
  readonly binding: ProjectRuntimeBinding;
};
export interface ProjectRuntimeRegistryOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly stderr?: NodeJS.WritableStream;
  readonly createRuntime?: typeof createAcpRuntime;
}
export class ProjectBindingError extends Error {
  readonly code = "PROJECT_BINDING_CONFLICT";
}

const pathKey = (path: string): string =>
  process.platform === "win32" ? path.toLowerCase() : path;
export function canonicalProjectDirectory(directory: string): string {
  if (!isAbsolute(directory))
    throw new Error(
      "Engine session cwd must be an absolute project directory.",
    );
  const cwd = realpathSync(directory);
  if (!statSync(cwd).isDirectory())
    throw new Error("Engine project is not a directory.");
  return cwd;
}
interface Claim {
  readonly owner: ProjectRuntimeRegistry;
  namespace: string | undefined;
}
// In-process binding claims complement the registry process leases below.
const storageClaims = new Map<string, Set<Claim>>();
const projectClaims = new Map<string, ProjectRuntimeRegistry>();

/** Concrete engine runtime owner, also borrowable by the forthcoming host facade. */
export class ProjectRuntimeRegistry {
  readonly #env: NodeJS.ProcessEnv;
  readonly #options: ProjectRuntimeRegistryOptions;
  readonly #projects = new Map<
    string,
    { project: ProjectRuntime; release: () => void }
  >();
  #stopping = false;
  #closed = false;

  constructor(options: ProjectRuntimeRegistryOptions) {
    this.#options = options;
    this.#env = { ...options.env };
  }

  findByProjectId(projectId: string): ProjectRuntime | undefined {
    return [...this.#projects.values()].find(
      ({ project }) => project.binding.projectId === projectId,
    )?.project;
  }

  /** V1/CLI compatibility initialization, distinct from strict existing attachment. */
  openConfigured(
    directory: string,
    configured: NodeJS.ProcessEnv,
  ): ProjectRuntime {
    this.#requireOpen();
    const cwd = canonicalProjectDirectory(directory);
    const config = parseLocalRuntimeConfig(configured, { surface: "acp" });
    const sqlitePath = config.sqliteIsMemory
      ? ":memory:"
      : storagePath(config.sqlitePath);
    const source =
      config.sourceStorePath && storagePath(config.sourceStorePath);
const current = this.#projects.get(pathKey(cwd))?.project;

if (current) {
  const projectIdConflict =
    config.projectId !== undefined &&
    config.projectId !== current.binding.projectId;

  const sqliteConflict =
    pathKey(sqlitePath) !== pathKey(current.binding.sqlitePath);

  const sourceConflict =
    source !== undefined &&
    pathKey(source) !==
      (current.binding.sourceStorePath
        ? pathKey(current.binding.sourceStorePath)
        : undefined);

  if (projectIdConflict || sqliteConflict || sourceConflict) {
    throw new ProjectBindingError(
      "Project already has a different runtime binding.",
    );
  }

  return current;
}
    return this.#open(cwd, {
      ...configured,
      A008_MEMORY_SQLITE_PATH: sqlitePath,
      A008_SOURCE_STORE_PATH: source,
    });
  }

  /** Preserve existing ACP engine data layout and explicit legacy compatibility. */
  openEngine(directory: string): ProjectRuntime {
    this.#requireOpen();
    const cwd = canonicalProjectDirectory(directory),
      key = pathKey(cwd);
    const cached = this.#projects.get(key);
    if (cached) return cached.project;
    const configured = this.#env;
    const root = resolve(
      configured.A008_ENGINE_DATA_PATH || join(homedir(), ".a008", "engine"),
    );
    const data = join(
      root,
      "projects",
      createHash("sha256").update(key).digest("hex"),
    );
    const legacy =
      configured.A008_ENGINE_LEGACY_CWD &&
      pathKey(realpathSync(configured.A008_ENGINE_LEGACY_CWD)) === key;
    if (
      legacy &&
      (!configured.A008_MEMORY_SQLITE_PATH ||
        !configured.A008_SOURCE_STORE_PATH)
    ) {
      throw new Error(
        "Legacy attachment requires explicit memory and source-store paths.",
      );
    }
    const env = legacy
      ? { ...configured }
      : {
          ...configured,
          A008_PROJECT_ID: undefined,
          A008_MEMORY_SQLITE_PATH: join(data, "memory.sqlite"),
          A008_SOURCE_STORE_PATH: join(data, "sources"),
        };
    return this.#open(cwd, env);
  }

  /** Existing means existing: never create a missing file/namespace on this path. */
  attachExisting(input: ExistingProjectAttachment): ProjectRuntime {
    this.#requireOpen();
    const cwd = canonicalProjectDirectory(input.cwd);
    const projectId = parseRuntimeId(input.projectId, "project");
    if (
      !isAbsolute(input.sqlitePath) ||
      !existsSync(input.sqlitePath) ||
      !statSync(input.sqlitePath).isFile()
    ) {
      throw new ProjectBindingError(
        "Existing attachment requires an existing absolute SQLite file.",
      );
    }
    const sqlitePath = storagePath(input.sqlitePath);
    let sourceStorePath: string | undefined;
    if (input.sourceStorePath !== undefined) {
      if (
        !isAbsolute(input.sourceStorePath) ||
        !existsSync(input.sourceStorePath) ||
        !statSync(input.sourceStorePath).isDirectory()
      ) {
        throw new ProjectBindingError(
          "Existing attachment requires an existing absolute source-store directory.",
        );
      }
      sourceStorePath = storagePath(input.sourceStorePath);
    }
    const current = this.#projects.get(pathKey(cwd))?.project;
    if (current) {
      const binding = current.binding;
      if (
        binding.projectId !== projectId ||
        pathKey(binding.sqlitePath) !== pathKey(sqlitePath) ||
        (binding.sourceStorePath && pathKey(binding.sourceStorePath)) !==
          (sourceStorePath && pathKey(sourceStorePath))
      ) {
        throw new ProjectBindingError(
          "Project already has a different runtime binding.",
        );
      }
      return current;
    }
    const database = new Database(sqlitePath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      const hasMeta = database
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'A008_knowledge_meta'",
        )
        .get();
      // Incremental evidence writes need not change the transition counters in
      // meta. A persisted artifact or completed namespace initialization also
      // identifies a valid project in a shared database.
      const hasNamespace = [
        "A008_knowledge_meta",
        "A008_knowledge_artifacts",
        "A008_knowledge_migration",
      ].some(
        (table) =>
          database
            .prepare(
              "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            )
            .get(table) &&
          database
            .prepare(`SELECT 1 FROM ${table} WHERE namespace = ? LIMIT 1`)
            .get(projectId),
      );
      const sidecar = projectIdSidecarPath(sqlitePath);
      // A never-written empty store may only identify its namespace by sidecar.
      const sidecarId = existsSync(sidecar)
        ? readFileSync(sidecar, "utf8").trim()
        : undefined;
      if (!hasMeta || (!hasNamespace && sidecarId !== projectId)) {
        throw new ProjectBindingError(
          "The requested project namespace is absent from the existing store.",
        );
      }
    } finally {
      database.close();
    }
    return this.#open(cwd, {
      ...this.#env,
      A008_PROJECT_ID: projectId,
      A008_MEMORY_SQLITE_PATH: sqlitePath,
      A008_SOURCE_STORE_PATH: sourceStorePath,
    });
  }

  #open(cwd: string, env: NodeJS.ProcessEnv): ProjectRuntime {
    const projectKey = pathKey(cwd);
    if (projectClaims.has(projectKey))
      throw new ProjectBindingError(
        "Project directory already has a runtime owner.",
      );
    const sqlitePath =
      env.A008_MEMORY_SQLITE_PATH === ":memory:"
        ? ":memory:"
        : storagePath(env.A008_MEMORY_SQLITE_PATH!);
    const sidecar =
      sqlitePath === ":memory:" ? undefined : projectIdSidecarPath(sqlitePath);
    const releaseInitialization = sidecar
      ? acquireRuntimeLease(sidecar, "identity-initialization", 5000)
      : () => {};
    let releaseOwnership = () => {};
    try {
      const namespace =
        env.A008_PROJECT_ID?.trim() ||
        (sidecar && existsSync(sidecar)
          ? readFileSync(sidecar, "utf8").trim()
          : undefined);
      const storageKey = pathKey(sqlitePath);
      const claims = storageClaims.get(storageKey) ?? new Set<Claim>();
      if (
        sqlitePath !== ":memory:" &&
        [...claims].some(
          (claim) =>
            !namespace || !claim.namespace || claim.namespace === namespace,
        )
      ) {
        throw new ProjectBindingError(
          "The project memory namespace already has a runtime owner.",
        );
      }
      if (sqlitePath !== ":memory:" && namespace)
        releaseOwnership = acquireRuntimeLease(sqlitePath, namespace);
      const claim: Claim = { owner: this, namespace };
      projectClaims.set(projectKey, this);
      if (sqlitePath !== ":memory:") {
        claims.add(claim);
        storageClaims.set(storageKey, claims);
      }
      const release = () => {
        releaseOwnership();
        if (projectClaims.get(projectKey) === this)
          projectClaims.delete(projectKey);
        claims.delete(claim);
        if (!claims.size && storageClaims.get(storageKey) === claims)
          storageClaims.delete(storageKey);
      };
      let opened: ReturnType<typeof createAcpRuntime> | undefined;
      try {
        opened = (this.#options.createRuntime ?? createAcpRuntime)({
          env,
          cwd,
          stderr: this.#options.stderr ?? process.stderr,
          ownershipAlreadyHeld: true,
        });
        this.#requireOpen();
        if (sqlitePath !== ":memory:" && !namespace)
          releaseOwnership = acquireRuntimeLease(
            sqlitePath,
            opened.runtime.projectId,
          );
        claim.namespace = opened.runtime.projectId;
        const source = opened.runtime.sourceStoreRoot;
        const project: ProjectRuntime = {
          ...opened,
          cwd,
          binding: {
            cwd,
            projectId: opened.runtime.projectId,
            sqlitePath,
            ...(source === undefined
              ? {}
              : { sourceStorePath: storagePath(source) }),
          },
        };
        this.#projects.set(pathKey(cwd), { project, release });
        return project;
      } catch (error) {
        try {
          opened?.runtime.close();
        } finally {
          release();
        }
        throw error;
      }
    } finally {
      releaseInitialization();
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#stopping = true;
    if (
      [...this.#projects.values()].some(
        ({ project }) => project.agent.openSessionIds().length > 0,
      )
    ) {
      throw new Error(
        "Close project sessions before disposing the runtime registry.",
      );
    }
    const errors: unknown[] = [];
    for (const [key, { project, release }] of this.#projects) {
      try {
        project.runtime.close();
        release();
        this.#projects.delete(key);
      } catch (error) {
        errors.push(error);
      }
    }
    this.#closed = this.#projects.size === 0;
    if (errors.length)
      throw new AggregateError(errors, "Project runtime disposal failed.");
  }

  #requireOpen(): void {
    if (this.#stopping)
      throw new Error("Project runtime registry is stopping.");
  }
}
