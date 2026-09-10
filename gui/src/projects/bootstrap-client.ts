import { engineHeaders } from "../session/engine-access.js";

export interface ProjectBootstrapConfig {
  readonly projectName: string;
  readonly rootFolder: string;
  readonly repository: { readonly initialize: boolean; readonly name?: string };
  readonly continuity: {
    readonly docsFirst: boolean;
    readonly multiAgent: {
      readonly enabled: boolean;
      readonly maxWorkers?: number;
      readonly workerCloneRoot?: string;
    };
  };
  readonly memory: { readonly useGlobalA008Memory: boolean };
}

export interface ProjectBootstrapPlan {
  readonly projectId: string;
  readonly projectName: string;
  readonly rootFolder: string;
  readonly mutations: readonly { readonly kind: string; readonly path: string }[];
  readonly memory: { readonly useGlobalStore: boolean; readonly namespace: string };
  readonly multiAgent:
    | { readonly enabled: false }
    | { readonly enabled: true; readonly maxWorkers: number; readonly workerCloneRoot: string };
}

export interface RegisteredProject {
  readonly projectId: string;
  readonly name: string;
  readonly rootFolder: string;
}

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      body !== null && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
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
): Promise<{ plan: ProjectBootstrapPlan }> {
  const response = await fetchImpl("/v1/projects/bootstrap", {
    method: "POST",
    headers: { ...engineHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ ...config, ...(projectId ? { projectId } : {}) }),
  });
  return (await readJson(response)) as { plan: ProjectBootstrapPlan };
}

export async function listProjects(
  fetchImpl: typeof fetch = fetch,
): Promise<{ currentId: string | null; projects: readonly RegisteredProject[] }> {
  const response = await fetchImpl("/v1/projects", {
    headers: { ...engineHeaders(), accept: "application/json" },
    cache: "no-store",
  });
  return (await readJson(response)) as {
    currentId: string | null;
    projects: readonly RegisteredProject[];
  };
}

export async function openProject(
  projectId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ cwd: string; projectId: string }> {
  const response = await fetchImpl("/v1/projects/open", {
    method: "POST",
    headers: { ...engineHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  return (await readJson(response)) as { cwd: string; projectId: string };
}
