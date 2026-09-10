import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { ChatError } from "../core/errors.js";
import { parseRuntimeId, RuntimeIdentityFactory } from "../identity/runtime-id.js";
import { planProjectBootstrap } from "./plan.js";
import { plannedFiles } from "./plan.js";
import {
  findProjectById,
  findProjectByRoot,
  readProjectRegistry,
  upsertRegisteredProject,
  writeProjectRegistry,
} from "./registry.js";
import type {
  ProjectBootstrapConfig,
  ProjectBootstrapPlan,
  RegisteredProject,
} from "./types.js";

export interface ProjectBootstrapStore {
  readonly registryPath: string;
  readonly createId?: () => string;
}

function listNonDot(path: string): readonly string[] {
  return readdirSync(path).filter((name) => name !== "." && name !== "..");
}

function assertWritableRoot(rootFolder: string, files: Readonly<Record<string, string>>): void {
  if (!existsSync(rootFolder)) return;
  const existing = listNonDot(rootFolder);
  if (existing.length === 0) return;
  if (existing.includes("AGENTS.md") || existing.includes("docs")) {
    throw new ChatError(
      "configuration",
      "Project root already contains docs-first files. Refusing to overwrite.",
    );
  }
  const allowed = new Set([".git"]);
  if (existing.some((name) => !allowed.has(name))) {
    throw new ChatError(
      "configuration",
      "Project root is not empty. Choose another folder.",
    );
  }
  if (Object.keys(files).length > 0 && existing.includes(".git")) {
    /* git-only folder may receive docs-first files */
    return;
  }
}

function gitInit(path: string): void {
  if (existsSync(join(path, ".git"))) return;
  const result = spawnSync("git", ["init"], {
    cwd: path,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new ChatError(
      "server",
      result.stderr?.trim() || "git init failed.",
    );
  }
}

export function previewProjectBootstrap(
  config: ProjectBootstrapConfig,
  store: ProjectBootstrapStore,
  projectId?: string,
): ProjectBootstrapPlan {
  const factory = new RuntimeIdentityFactory(store.createId);
  const existing = findProjectByRoot(readProjectRegistry(store.registryPath), config.rootFolder);
  const id =
    projectId !== undefined
      ? parseRuntimeId(projectId, "project")
      : existing?.projectId ?? factory.create("project");
  return planProjectBootstrap(config, id);
}

export function executeProjectBootstrap(
  config: ProjectBootstrapConfig,
  store: ProjectBootstrapStore,
  projectId?: string,
): { readonly plan: ProjectBootstrapPlan; readonly project: RegisteredProject } {
  const plan = previewProjectBootstrap(config, store, projectId);
  const files = plannedFiles(config);
  assertWritableRoot(config.rootFolder, files);
  mkdirSync(config.rootFolder, { recursive: true });
  for (const [relativePath, body] of Object.entries(files)) {
    const path = join(config.rootFolder, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      throw new ChatError("configuration", `Refusing to overwrite ${relativePath}.`);
    }
    writeFileSync(path, body, "utf8");
  }
  if (config.repository.initialize) {
    gitInit(config.rootFolder);
  }
  if (plan.multiAgent.enabled) {
    mkdirSync(plan.multiAgent.workerCloneRoot, { recursive: true });
  }
  const project: RegisteredProject = {
    projectId: plan.projectId,
    name: config.projectName,
    rootFolder: config.rootFolder,
    createdAt: new Date().toISOString(),
    repository: {
      initialize: config.repository.initialize,
      name: plan.repositoryName,
    },
    continuity: {
      docsFirst: config.continuity.docsFirst,
      multiAgent: plan.multiAgent,
    },
    memory: { useGlobalA008Memory: config.memory.useGlobalA008Memory },
  };
  const registry = upsertRegisteredProject(
    readProjectRegistry(store.registryPath),
    project,
    true,
  );
  writeProjectRegistry(store.registryPath, registry);
  return { plan, project };
}

export function openRegisteredProject(
  projectId: string,
  store: ProjectBootstrapStore,
): RegisteredProject {
  const registry = readProjectRegistry(store.registryPath);
  const project = findProjectById(registry, projectId);
  if (project === undefined) {
    throw new ChatError("configuration", "Unknown project.");
  }
  writeProjectRegistry(
    store.registryPath,
    upsertRegisteredProject(registry, project, true),
  );
  return project;
}
