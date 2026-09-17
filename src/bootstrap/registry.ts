import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { ChatError } from "../core/errors.js";
import {
  PROJECT_REGISTRY_VERSION,
  type ProjectRegistryDocument,
  type RegisteredProject,
} from "./types.js";

export const PROJECTS_PATH_ENV = "A008_PROJECTS_PATH";

export function defaultProjectsPath(): string {
  return join(homedir(), ".a008", "projects.json");
}

export function resolveProjectsPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env[PROJECTS_PATH_ENV]?.trim();
  const path = resolve(configured || defaultProjectsPath());
  if (!isAbsolute(path)) {
    throw new ChatError(
      "configuration",
      "A008_PROJECTS_PATH must be an absolute path.",
    );
  }
  return path;
}

function emptyRegistry(): ProjectRegistryDocument {
  return { version: PROJECT_REGISTRY_VERSION, currentId: null, projects: [] };
}

export function readProjectRegistry(path: string): ProjectRegistryDocument {
  if (!existsSync(path)) return emptyRegistry();
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (parsed as { version?: unknown }).version !== PROJECT_REGISTRY_VERSION ||
    !Array.isArray((parsed as { projects?: unknown }).projects)
  ) {
    throw new ChatError("configuration", "Cannot read A008 project registry.");
  }
  const document = parsed as ProjectRegistryDocument;
  return {
    version: PROJECT_REGISTRY_VERSION,
    currentId:
      typeof document.currentId === "string" ? document.currentId : null,
    projects: document.projects,
  };
}

export function writeProjectRegistry(
  path: string,
  document: ProjectRegistryDocument,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

export function upsertRegisteredProject(
  document: ProjectRegistryDocument,
  project: RegisteredProject,
  current: boolean,
): ProjectRegistryDocument {
  const projects = [
    ...document.projects.filter(
      (entry) => entry.projectId !== project.projectId,
    ),
    project,
  ];
  return {
    version: PROJECT_REGISTRY_VERSION,
    currentId: current ? project.projectId : document.currentId,
    projects,
  };
}

function projectRootKey(rootFolder: string): string {
  const absolute = resolve(rootFolder);
  const canonical = existsSync(absolute) ? realpathSync(absolute) : absolute;
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}

export function findProjectByRoot(
  document: ProjectRegistryDocument,
  rootFolder: string,
): RegisteredProject | undefined {
  const target = projectRootKey(rootFolder);
  return document.projects.find(
    (entry) => projectRootKey(entry.rootFolder) === target,
  );
}

export function findProjectById(
  document: ProjectRegistryDocument,
  projectId: string,
): RegisteredProject | undefined {
  return document.projects.find((entry) => entry.projectId === projectId);
}
