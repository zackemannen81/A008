import { join } from "node:path";
import type { RuntimeIdentityFactory } from "../identity/runtime-id.js";
import {
  docsFirstFiles,
  multiAgentPolicy,
  taskPrefixFromName,
} from "./templates.js";
import type {
  PlannedMutation,
  ProjectBootstrapConfig,
  ProjectBootstrapPlan,
} from "./types.js";
import { DEFAULT_MAX_WORKERS } from "./types.js";

export function plannedFiles(
  config: ProjectBootstrapConfig,
): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  if (config.continuity.docsFirst) {
    Object.assign(
      files,
      docsFirstFiles({
        projectName: config.projectName,
        taskPrefix: taskPrefixFromName(config.projectName),
      }),
    );
  }
  if (config.continuity.multiAgent.enabled) {
    const multi = config.continuity.multiAgent;
    files["docs/MULTIAGENT.md"] = multiAgentPolicy({
      maxWorkers: multi.maxWorkers ?? DEFAULT_MAX_WORKERS,
      workerCloneRoot: multi.workerCloneRoot ?? "",
    });
  }
  return files;
}

export function planProjectBootstrap(
  config: ProjectBootstrapConfig,
  projectId: string,
): ProjectBootstrapPlan {
  const mutations: PlannedMutation[] = [
    { kind: "mkdir", path: config.rootFolder },
  ];
  const files = plannedFiles(config);
  for (const [relativePath, body] of Object.entries(files)) {
    const path = join(config.rootFolder, relativePath);
    mutations.push({
      kind: "write",
      path,
      bytes: Buffer.byteLength(body),
    });
  }
  if (config.repository.initialize) {
    mutations.push({ kind: "git-init", path: config.rootFolder });
  }
  const multi = config.continuity.multiAgent;
  if (multi.enabled && multi.workerCloneRoot) {
    mutations.push({ kind: "mkdir", path: multi.workerCloneRoot });
  }
  return {
    projectId,
    projectName: config.projectName,
    rootFolder: config.rootFolder,
    repositoryName: config.repository.name ?? "",
    mutations,
    memory: {
      useGlobalStore: config.memory.useGlobalA008Memory,
      namespace: projectId,
    },
    multiAgent: multi.enabled
      ? {
          enabled: true,
          maxWorkers: multi.maxWorkers ?? DEFAULT_MAX_WORKERS,
          workerCloneRoot: multi.workerCloneRoot ?? "",
        }
      : { enabled: false },
  };
}

export function createProjectId(factory: RuntimeIdentityFactory): string {
  return factory.create("project");
}
