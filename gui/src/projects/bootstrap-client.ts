import {
  createProject as createProjectFromClient,
  listProjects as listProjectsFromClient,
  openProject as openProjectFromClient,
  previewProject as previewProjectFromClient,
  registerExistingProject as registerExistingFromClient,
} from "../../../packages/client/src/index.js";
import type {
  ExistingProjectRegistration,
  ProjectBootstrapConfig,
  ProjectBootstrapPlan,
  ProjectCreated,
  ProjectsResponse,
  RegisteredProject,
  WorkspaceBinding,
} from "../../../packages/protocol/src/index.js";
export type {
  ExistingProjectRegistration,
  ProjectBootstrapConfig,
  ProjectBootstrapPlan,
  RegisteredProject,
} from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

export async function previewProject(
  config: ProjectBootstrapConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectBootstrapPlan> {
  return previewProjectFromClient(guiHttp(fetchImpl), config);
}

export async function createProject(
  config: ProjectBootstrapConfig,
  projectId?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectCreated> {
  return createProjectFromClient(guiHttp(fetchImpl), config, projectId);
}

export async function registerExistingProject(
  config: ExistingProjectRegistration,
  fetchImpl: typeof fetch = fetch,
): Promise<RegisteredProject> {
  return registerExistingFromClient(guiHttp(fetchImpl), config);
}

export async function listProjects(
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectsResponse> {
  return listProjectsFromClient(guiHttp(fetchImpl));
}

export async function openProject(
  projectId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceBinding> {
  return openProjectFromClient(guiHttp(fetchImpl), projectId);
}
