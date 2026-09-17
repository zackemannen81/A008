import type {
  ExistingProjectRegistration,
  ProjectBootstrapConfig,
  ProjectBootstrapPlan,
  RegisteredProject,
  ProjectsResponse,
  ProjectCreated,
  WorkspaceBinding,
} from "../../../packages/protocol/src/index.js";
export type {
  ExistingProjectRegistration,
  ProjectBootstrapConfig,
  ProjectBootstrapPlan,
  RegisteredProject,
} from "../../../packages/protocol/src/index.js";
import { engineHeaders } from "../session/engine-access.js";

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      body !== null &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${String(response.status)})`;
    throw new Error(message);
  }
  return body;
}

export async function previewProject(
  config: ProjectBootstrapConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectBootstrapPlan> {
  const response = await fetchImpl("/v1/projects/preview", {
    method: "POST",
    headers: { ...engineHeaders(), "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  return (await readJson(response)) as ProjectBootstrapPlan;
}

export async function createProject(
  config: ProjectBootstrapConfig,
  projectId?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectCreated> {
  const response = await fetchImpl("/v1/projects/bootstrap", {
    method: "POST",
    headers: { ...engineHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ ...config, ...(projectId ? { projectId } : {}) }),
  });
  return (await readJson(response)) as ProjectCreated;
}

export async function registerExistingProject(
  config: ExistingProjectRegistration,
  fetchImpl: typeof fetch = fetch,
): Promise<RegisteredProject> {
  const response = await fetchImpl("/v1/projects/register", {
    method: "POST",
    headers: { ...engineHeaders(), "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  return (await readJson(response)) as RegisteredProject;
}

export async function listProjects(
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectsResponse> {
  const response = await fetchImpl("/v1/projects", {
    headers: { ...engineHeaders(), accept: "application/json" },
    cache: "no-store",
  });
  return (await readJson(response)) as ProjectsResponse;
}

export async function openProject(
  projectId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceBinding> {
  const response = await fetchImpl("/v1/projects/open", {
    method: "POST",
    headers: { ...engineHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  return (await readJson(response)) as WorkspaceBinding;
}
