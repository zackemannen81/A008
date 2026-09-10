import { isAbsolute, relative, resolve, sep } from "node:path";
import { ChatError } from "../core/errors.js";
import {
  DEFAULT_MAX_WORKERS,
  MAX_WORKERS_CEILING,
  type ProjectBootstrapConfig,
} from "./types.js";

export function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 40);
  return slug.length > 0 ? slug : "project";
}

export function isInsideDirectory(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith("../"));
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ChatError("configuration", `${label} is required.`);
  }
  return value.trim();
}

function flag(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ChatError("configuration", `${label} must be true or false.`);
  }
  return value;
}

export function parseProjectBootstrapConfig(raw: unknown): ProjectBootstrapConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ChatError("configuration", "Project bootstrap config must be an object.");
  }
  const body = raw as Record<string, unknown>;
  const projectName = requiredString(body.projectName, "Project name");
  const rootFolder = requiredString(body.rootFolder, "Project root folder");
  if (!isAbsolute(rootFolder)) {
    throw new ChatError("configuration", "Project root folder must be an absolute path.");
  }
  const repositoryRaw =
    body.repository !== null && typeof body.repository === "object" && !Array.isArray(body.repository)
      ? (body.repository as Record<string, unknown>)
      : {};
  const initialize = flag(repositoryRaw.initialize ?? false, "Initialize Git repository");
  const repositoryName =
    typeof repositoryRaw.name === "string" && repositoryRaw.name.trim() !== ""
      ? repositoryRaw.name.trim()
      : slugFromName(projectName);
  const continuityRaw =
    body.continuity !== null && typeof body.continuity === "object" && !Array.isArray(body.continuity)
      ? (body.continuity as Record<string, unknown>)
      : {};
  const docsFirst = flag(continuityRaw.docsFirst ?? false, "Docs-First Continuity Protocol");
  const multiRaw =
    continuityRaw.multiAgent !== null &&
    typeof continuityRaw.multiAgent === "object" &&
    !Array.isArray(continuityRaw.multiAgent)
      ? (continuityRaw.multiAgent as Record<string, unknown>)
      : {};
  const multiEnabled = flag(multiRaw.enabled ?? false, "Multi-Agent Orchestrator Add-on");
  if (multiEnabled && !docsFirst) {
    throw new ChatError(
      "configuration",
      "Docs-First Continuity Protocol is required for the multi-agent add-on.",
    );
  }
  let maxWorkers = DEFAULT_MAX_WORKERS;
  let workerCloneRoot: string | undefined;
  if (multiEnabled) {
    if (multiRaw.maxWorkers !== undefined) {
      if (
        typeof multiRaw.maxWorkers !== "number" ||
        !Number.isSafeInteger(multiRaw.maxWorkers) ||
        multiRaw.maxWorkers < 1 ||
        multiRaw.maxWorkers > MAX_WORKERS_CEILING
      ) {
        throw new ChatError(
          "configuration",
          `Max worker agents must be a whole number from 1 to ${String(MAX_WORKERS_CEILING)}.`,
        );
      }
      maxWorkers = multiRaw.maxWorkers;
    }
    workerCloneRoot = requiredString(multiRaw.workerCloneRoot, "Worker clone root folder");
    if (!isAbsolute(workerCloneRoot)) {
      throw new ChatError("configuration", "Worker clone root folder must be an absolute path.");
    }
    if (isInsideDirectory(workerCloneRoot, rootFolder)) {
      throw new ChatError(
        "configuration",
        "Worker clone root must be outside the project tree.",
      );
    }
  }
  const memoryRaw =
    body.memory !== null && typeof body.memory === "object" && !Array.isArray(body.memory)
      ? (body.memory as Record<string, unknown>)
      : {};
  const useGlobalA008Memory = flag(
    memoryRaw.useGlobalA008Memory ?? true,
    "Use global A008 memory",
  );
  return {
    projectName,
    rootFolder: resolve(rootFolder),
    repository: {
      initialize,
      name: repositoryName,
    },
    continuity: {
      docsFirst: docsFirst || multiEnabled,
      multiAgent: multiEnabled
        ? {
            enabled: true,
            maxWorkers,
            workerCloneRoot: resolve(workerCloneRoot!),
          }
        : { enabled: false },
    },
    memory: { useGlobalA008Memory },
  };
}
