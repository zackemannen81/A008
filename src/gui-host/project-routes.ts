import { existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { ChatError } from "../core/errors.js";
import {
  executeProjectBootstrap,
  openRegisteredProject,
  previewProjectBootstrap,
  type ProjectBootstrapStore,
} from "../bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../bootstrap/validate.js";
import { readProjectRegistry } from "../bootstrap/registry.js";
import type {
  ProjectBootstrapPlan,
  RegisteredProject,
} from "../bootstrap/types.js";

export interface WorkspaceBinding {
  readonly cwd: string;
  readonly projectId: string;
  readonly useGlobalMemory: boolean;
}

export function handleProjectPreview(
  store: ProjectBootstrapStore,
  body: unknown,
): ProjectBootstrapPlan {
  return previewProjectBootstrap(parseProjectBootstrapConfig(body), store);
}

export function handleProjectBootstrap(
  store: ProjectBootstrapStore,
  body: unknown,
): { plan: ProjectBootstrapPlan; project: RegisteredProject } {
  const projectId =
    body !== null && typeof body === "object" && !Array.isArray(body) &&
    typeof (body as { projectId?: unknown }).projectId === "string"
      ? (body as { projectId: string }).projectId
      : undefined;
  return executeProjectBootstrap(parseProjectBootstrapConfig(body), store, projectId);
}

export function handleProjectList(store: ProjectBootstrapStore): {
  currentId: string | null;
  projects: readonly RegisteredProject[];
} {
  const registry = readProjectRegistry(store.registryPath);
  return { currentId: registry.currentId, projects: registry.projects };
}

export function handleProjectOpen(
  store: ProjectBootstrapStore,
  body: unknown,
): WorkspaceBinding {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ChatError("configuration", "Open project requires an object.");
  }
  const projectId = (body as { projectId?: unknown }).projectId;
  if (typeof projectId !== "string" || projectId.trim() === "") {
    throw new ChatError("configuration", "projectId is required.");
  }
  const project = openRegisteredProject(projectId, store);
  return bindingFor(project);
}

export function bindingFor(project: RegisteredProject): WorkspaceBinding {
  return {
    cwd: project.rootFolder,
    projectId: project.projectId,
    useGlobalMemory: project.memory.useGlobalA008Memory,
  };
}

export function handleDirectoryList(pathValue: unknown): {
  path: string;
  entries: readonly string[];
} {
  if (typeof pathValue !== "string" || !isAbsolute(pathValue)) {
    throw new ChatError("configuration", "Browse path must be absolute.");
  }
  const path = resolve(pathValue);
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new ChatError("configuration", "Browse path must be an existing directory.");
  }
  const entries = readdirSync(path)
    .filter((name) => {
      try {
        return statSync(resolve(path, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b));
  return { path, entries };
}


