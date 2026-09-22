import {
  parseFrameCheck,
  parseMemorySnapshot,
  parseShellHostResult,
  parseUploadedSource,
  modelsResponseSchema,
  ShellCommandError,
  UploadError,
  v2InfoSchema,
  zeroCostCatalogSchema,
  type ExistingProjectRegistration,
  type FrameCheck,
  type GeneratedImage,
  type GuiModel,
  type KieCatalog,
  type McpServerCatalog,
  type McpServerHealth,
  type MemorySnapshot,
  type NvidiaCatalog,
  type ProjectBootstrapConfig,
  type ProjectBootstrapPlan,
  type ProjectCreated,
  type ProjectsResponse,
  type ProviderSettings,
  type ProviderSettingsUpdate,
  type RegisteredProject,
  type ShellHostResult,
  type UploadedSource,
  type V2Info,
  type WorkspaceBinding,
  type ZeroCostCatalog,
} from "@a008/protocol";
import type { CredentialAdapter } from "./credentials.js";
import {
  messageFromBody,
  requestJson,
  type ClientFetch,
  type HttpClientOptions,
} from "./http.js";
import type { ClientLocation } from "./origin.js";
import { detectBrowserCredentials } from "./credentials.js";

export interface MemoryFilters {
  readonly query: string;
  readonly kind: string;
  readonly domain: string;
  readonly status: string;
  readonly offset: number;
}

export const EMPTY_MEMORY_FILTERS: MemoryFilters = {
  query: "",
  kind: "",
  domain: "",
  status: "",
  offset: 0,
};

export const UPLOAD_ENDPOINT = "/v1/upload";
export const SHELL_ENDPOINT = "/v1/shell";

export interface UploadableFile {
  readonly name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withSignal(signal?: AbortSignal): { signal?: AbortSignal } {
  return signal ? { signal } : {};
}

export function createHttpClient(options: HttpClientOptions) {
  return {
    loadModels: (signal?: AbortSignal) => loadModels(options, signal),
    loadMemory: (filters: MemoryFilters, signal?: AbortSignal) =>
      loadMemory(options, filters, signal),
    uploadSource: (file: UploadableFile) => uploadSource(options, file),
    uploadSourcePath: (localPath: string) => uploadSourcePath(options, localPath),
    executeShellCommand: (command: string) =>
      executeShellCommand(options, command),
    previewProject: (config: ProjectBootstrapConfig) =>
      previewProject(options, config),
    createProject: (config: ProjectBootstrapConfig, projectId?: string) =>
      createProject(options, config, projectId),
    registerExistingProject: (config: ExistingProjectRegistration) =>
      registerExistingProject(options, config),
    listProjects: () => listProjects(options),
    openProject: (projectId: string) => openProject(options, projectId),
    loadNvidiaCatalog: (signal?: AbortSignal) =>
      loadNvidiaCatalog(options, signal),
    addNvidiaModel: (id: string, provider = "nvidia") =>
      addNvidiaModel(options, id, provider),
    loadKieCatalog: (signal?: AbortSignal) => loadKieCatalog(options, signal),
    loadProviderSettings: (signal?: AbortSignal) =>
      loadProviderSettings(options, signal),
    saveProviderSettings: (body: ProviderSettingsUpdate) =>
      saveProviderSettings(options, body),
    loadMcpServers: (signal?: AbortSignal) => loadMcpServers(options, signal),
    saveMcpServers: (servers: McpServerCatalog["servers"]) =>
      saveMcpServers(options, servers),
    loadMcpHealth: (signal?: AbortSignal) => loadMcpHealth(options, signal),
    probeMcpServer: (name: string) => probeMcpServer(options, name),
    generateImage: (prompt: string) => generateImage(options, prompt),
    checkFrame: (url: string) => checkFrame(options, url),
    loadZeroCostCatalog: (signal?: AbortSignal) =>
      loadZeroCostCatalog(options, signal),
    refreshZeroCostCatalog: (signal?: AbortSignal) =>
      refreshZeroCostCatalog(options, signal),
    addZeroCostModel: (key: string) => addZeroCostModel(options, key),
    loadRuntimeCapabilities: (signal?: AbortSignal) =>
      loadRuntimeCapabilities(options, signal),
  };
}

export function browserHttpClient(options: {
  fetch: ClientFetch;
  origin?: string;
  credentials?: CredentialAdapter;
  location?: ClientLocation;
}): HttpClientOptions {
  return {
    fetch: options.fetch,
    origin: options.origin ?? "",
    credentials:
      options.credentials ?? detectBrowserCredentials(options.location),
  };
}

export async function loadModels(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<readonly GuiModel[]> {
  const { response, body } = await requestJson(client, "/v1/models", withSignal(signal));
  if (!response.ok)
    throw new Error(messageFromBody(body, "Cannot load models"));
  if (!modelsResponseSchema.safeParse(body).success) {
    throw new Error(
      "Model parameter metadata is unavailable. Restart the current A008 host.",
    );
  }
  return (body as { models: GuiModel[] }).models;
}

export async function loadMemory(
  client: HttpClientOptions,
  filters: MemoryFilters,
  signal?: AbortSignal,
): Promise<MemorySnapshot> {
  const params = new URLSearchParams({
    limit: "40",
    offset: String(filters.offset),
  });
  for (const key of ["query", "kind", "domain", "status"] as const)
    if (filters[key]) params.set(key, filters[key]);
  const { response, body } = await requestJson(
    client,
    `/v1/memory?${params.toString()}`,
    withSignal(signal),
  );
  if (body === undefined) {
    throw new Error(
      "Memory inspection is unavailable. Check that the A008 GUI host is running.",
    );
  }
  if (!response.ok) {
    throw new Error(
      messageFromBody(body, "Memory inspection failed"),
    );
  }
  return parseMemorySnapshot(body);
}

export async function uploadSource(
  client: HttpClientOptions,
  file: UploadableFile,
): Promise<UploadedSource> {
  const filename = file.name.trim();
  if (filename.length === 0) throw new UploadError("Select a file to upload.");
  let body: ArrayBuffer;
  try {
    body = await file.arrayBuffer();
  } catch (cause) {
    throw new UploadError("Could not read the selected file.", { cause });
  }
  let response;
  let payload: unknown;
  try {
    ({ response, body: payload } = await requestJson(client, UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-a008-filename": encodeURIComponent(filename),
      },
      body,
    }));
  } catch (cause) {
    throw new UploadError("Failed to reach the A008 GUI host upload route.", {
      cause,
    });
  }
  if (!response.ok) {
    throw new UploadError(
      `A008 GUI host upload failed (${String(response.status)}): ${messageFromBody(payload, "upload failed")}`,
    );
  }
  if (payload === undefined) {
    throw new UploadError("A008 GUI host upload route returned non-JSON.");
  }
  return parseUploadedSource(payload);
}

export async function uploadSourcePath(
  client: HttpClientOptions,
  localPath: string,
): Promise<UploadedSource> {
  const path = localPath.trim();
  if (path.length === 0)
    throw new UploadError("Enter an absolute local file path.");
  let response;
  let payload: unknown;
  try {
    ({ response, body: payload } = await requestJson(client, UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-a008-local-path": encodeURIComponent(path),
      },
    }));
  } catch (cause) {
    throw new UploadError("Failed to reach the A008 GUI host upload route.", {
      cause,
    });
  }
  if (!response.ok) {
    throw new UploadError(
      `A008 GUI host upload failed (${String(response.status)}): ${messageFromBody(payload, "upload failed")}`,
    );
  }
  if (payload === undefined) {
    throw new UploadError("A008 GUI host upload route returned non-JSON.");
  }
  return parseUploadedSource(payload);
}

export async function executeShellCommand(
  client: HttpClientOptions,
  command: string,
): Promise<ShellHostResult> {
  const normalized = command.trim();
  if (normalized.length === 0)
    throw new ShellCommandError("Terminal command must not be empty.");
  let response;
  let body: unknown;
  try {
    ({ response, body } = await requestJson(client, SHELL_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: normalized }),
    }));
  } catch (cause) {
    throw new ShellCommandError("Failed to reach the A008 GUI host shell.", {
      cause,
    });
  }
  if (!response.ok) {
    throw new ShellCommandError(
      `GUI host shell failed (${String(response.status)}): ${messageFromBody(body, "shell failed")}`,
    );
  }
  if (body === undefined)
    throw new ShellCommandError("GUI host shell returned non-JSON.");
  return parseShellHostResult(body);
}

export function formatShellHostResult(result: ShellHostResult): string {
  const lines = [
    `exit: ${result.exitCode ?? "null"}${result.timedOut ? " (timed out)" : ""}`,
  ];
  if (result.truncated) lines.push("output truncated");
  if (result.stdout.length > 0) {
    lines.push(
      "stdout:",
      result.stdout.endsWith("\n") ? result.stdout.slice(0, -1) : result.stdout,
    );
  }
  if (result.stderr.length > 0) {
    lines.push(
      "stderr:",
      result.stderr.endsWith("\n") ? result.stderr.slice(0, -1) : result.stderr,
    );
  }
  if (result.stdout.length === 0 && result.stderr.length === 0)
    lines.push("(no output)");
  return `${lines.join("\n")}\n`;
}

async function projectJson<T>(
  client: HttpClientOptions,
  path: string,
  init?: { method?: string; body?: string },
): Promise<T> {
  const request = {
    ...(init?.method ? { method: init.method } : {}),
    ...(init?.body
      ? {
          headers: { "content-type": "application/json" },
          body: init.body,
        }
      : {}),
  };
  const { response, body } = await requestJson(client, path, request);
  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : messageFromBody(body, "Request failed");
    throw new Error(message);
  }
  return body as T;
}

export function previewProject(
  client: HttpClientOptions,
  config: ProjectBootstrapConfig,
): Promise<ProjectBootstrapPlan> {
  return projectJson(client, "/v1/projects/preview", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export function createProject(
  client: HttpClientOptions,
  config: ProjectBootstrapConfig,
  projectId?: string,
): Promise<ProjectCreated> {
  return projectJson(client, "/v1/projects/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      ...config,
      ...(projectId ? { projectId } : {}),
    }),
  });
}

export function registerExistingProject(
  client: HttpClientOptions,
  config: ExistingProjectRegistration,
): Promise<RegisteredProject> {
  return projectJson(client, "/v1/projects/register", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export function listProjects(
  client: HttpClientOptions,
): Promise<ProjectsResponse> {
  return projectJson(client, "/v1/projects");
}

export function openProject(
  client: HttpClientOptions,
  projectId: string,
): Promise<WorkspaceBinding> {
  return projectJson(client, "/v1/projects/open", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
}

export async function loadNvidiaCatalog(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<NvidiaCatalog> {
  const { response, body } = await requestJson(
    client,
    "/v1/catalog/nvidia",
    withSignal(signal),
  );
  if (!response.ok)
    throw new Error(
      messageFromBody(body, "Could not load the NVIDIA catalog."),
    );
  return body as NvidiaCatalog;
}

export async function addNvidiaModel(
  client: HttpClientOptions,
  id: string,
  provider = "nvidia",
  name?: string,
): Promise<void> {
  const { response, body } = await requestJson(client, "/v1/catalog/nvidia", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, provider, ...(name ? { name } : {}) }),
  });
  if (!response.ok)
    throw new Error(messageFromBody(body, "Could not add that model."));
}

export async function loadKieCatalog(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<KieCatalog> {
  const { response, body } = await requestJson(
    client,
    "/v1/catalog/kie",
    withSignal(signal),
  );
  if (!response.ok)
    throw new Error(
      messageFromBody(body, "Could not load the kie.ai catalog."),
    );
  return body as KieCatalog;
}

export async function loadProviderSettings(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<ProviderSettings> {
  const { response, body } = await requestJson(
    client,
    "/v1/provider-settings",
    withSignal(signal),
  );
  if (!response.ok)
    throw new Error(
      messageFromBody(body, "Could not load provider settings."),
    );
  return body as ProviderSettings;
}

export async function saveProviderSettings(
  client: HttpClientOptions,
  body: ProviderSettingsUpdate,
): Promise<ProviderSettings> {
  const { response, body: payload } = await requestJson(
    client,
    "/v1/provider-settings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error(
      messageFromBody(body, "Could not save provider settings."),
    );
  return payload as ProviderSettings;
}

export async function loadMcpServers(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<McpServerCatalog> {
  const { response, body } = await requestJson(
    client,
    "/v1/mcp-servers",
    withSignal(signal),
  );
  if (!response.ok)
    throw new Error(
      messageFromBody(body, "Could not load MCP servers."),
    );
  return body as McpServerCatalog;
}

export async function loadMcpHealth(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<McpServerHealth> {
  const { response, body } = await requestJson(
    client,
    "/v1/mcp-servers/health",
    withSignal(signal),
  );
  if (!response.ok)
    throw new Error(messageFromBody(body, "Could not load MCP health."));
  return body as McpServerHealth;
}

export async function probeMcpServer(
  client: HttpClientOptions,
  name: string,
): Promise<McpServerHealth> {
  const { response, body } = await requestJson(
    client,
    "/v1/mcp-servers/probe",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  if (!response.ok)
    throw new Error(messageFromBody(body, "Could not test the MCP server."));
  return body as McpServerHealth;
}

export async function saveMcpServers(
  client: HttpClientOptions,
  servers: McpServerCatalog["servers"],
): Promise<McpServerCatalog> {
  const { response, body } = await requestJson(client, "/v1/mcp-servers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ servers }),
  });
  if (!response.ok)
    throw new Error(
      messageFromBody(body, "Could not save MCP servers."),
    );
  return body as McpServerCatalog;
}

export function generatedImageSrc(image: GeneratedImage): string {
  return `/v1/blobs/${image.sha256}/${encodeURIComponent(image.filename)}`;
}

export function generatedImageLocatorSrc(locator: string): string | undefined {
  const match = /^source:([a-f0-9]{64})\/(.+)$/u.exec(locator.trim());
  if (match === null) return undefined;
  return `/v1/blobs/${match[1]}/${encodeURIComponent(match[2]!)}`;
}

export async function generateImage(
  client: HttpClientOptions,
  prompt: string,
): Promise<GeneratedImage> {
  const trimmed = prompt.trim();
  if (trimmed.length === 0)
    throw new Error("Describe the image to generate.");
  const { response, body } = await requestJson(client, "/v1/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: trimmed }),
  });
  if (!response.ok)
    throw new Error(
      messageFromBody(body, "Image generation failed"),
    );
  return body as GeneratedImage;
}

export async function checkFrame(
  client: HttpClientOptions,
  url: string,
): Promise<FrameCheck> {
  const { response, body } = await requestJson(
    client,
    `/v1/browser/frame-check?url=${encodeURIComponent(url)}`,
  );
  if (!response.ok) return { url, embeddable: true };
  return parseFrameCheck(body, url);
}

export async function loadZeroCostCatalog(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<ZeroCostCatalog> {
  const { response, body } = await requestJson(
    client,
    "/v1/catalog/zero-cost",
    withSignal(signal),
  );
  if (!response.ok)
    throw new Error(
      `Could not load Zero Cost Radar (${String(response.status)}).`,
    );
  const parsed = zeroCostCatalogSchema.safeParse(body);
  if (!parsed.success)
    throw new Error("Zero Cost Radar metadata is incompatible with this GUI.");
  return parsed.data;
}

export async function refreshZeroCostCatalog(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<ZeroCostCatalog> {
  const { response, body } = await requestJson(
    client,
    "/v1/catalog/zero-cost",
    { method: "POST", ...withSignal(signal) },
  );
  if (!response.ok)
    throw new Error(
      messageFromBody(body, `Zero Cost Radar update check failed (${String(response.status)}).`),
    );
  const parsed = zeroCostCatalogSchema.safeParse(body);
  if (!parsed.success)
    throw new Error("Zero Cost Radar metadata is incompatible with this GUI.");
  return parsed.data;
}

export async function addZeroCostModel(
  client: HttpClientOptions,
  key: string,
): Promise<void> {
  const normalized = key.trim();
  if (!normalized) throw new Error("Zero Cost Radar route key is required.");
  const { response, body } = await requestJson(
    client,
    "/v1/catalog/zero-cost/models",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: normalized }),
    },
  );
  if (!response.ok) {
    throw new Error(
      messageFromBody(body, "Could not add that Zero Cost Radar model."),
    );
  }
}

export async function loadRuntimeCapabilities(
  client: HttpClientOptions,
  signal?: AbortSignal,
): Promise<V2Info> {
  const { response, body } = await requestJson(
    client,
    "/v2/info",
    withSignal(signal),
  );
  if (!response.ok)
    throw new Error(
      `V2 discovery is unavailable in this host mode (${String(response.status)}).`,
    );
  const parsed = v2InfoSchema.safeParse(body);
  if (!parsed.success)
    throw new Error("V2 discovery metadata is incompatible with this GUI.");
  return parsed.data;
}
