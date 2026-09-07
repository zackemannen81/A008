import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ChatError } from "../core/errors.js";
import {
  defaultSessionParameters,
  generationCapabilities,
} from "../core/generation-controls.js";
import type { ModelRegistry } from "../core/model-registry.js";
import {
  loadProviderSecrets,
  resolveNvidiaApiKey,
  saveProviderSecrets,
} from "../core/provider-secrets.js";
import {
  addUserChatModel,
  loadUserCatalog,
  removeUserChatModel,
  saveUserCatalog,
  userModelProfile,
  type UserChatModel,
} from "../core/user-catalog.js";
import { fetchNvidiaCatalog } from "../providers/nvidia/nvidia-catalog.js";
import { NvidiaImageTransport } from "../providers/nvidia/nvidia-image-transport.js";
import { blobPath, sanitiseUploadFilename, writeBlob } from "./source-store.js";

export type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergedModels(registry: ModelRegistry, catalogPath: string) {
  const extras = loadUserCatalog(catalogPath).chatModels.map(userModelProfile);
  const seen = new Set(registry.list().map((profile) => profile.id));
  return [
    ...registry.list(),
    ...extras.filter((profile) => !seen.has(profile.id)),
  ].map((profile) => ({
    id: profile.id,
    name: profile.name,
    defaults: defaultSessionParameters(profile),
    capabilities: generationCapabilities(profile.id),
    added: !registry.get(profile.id),
  }));
}

export async function handleNvidiaCatalogGet(input: {
  apiKey: string | undefined;
  fetch: FetchLike;
  registry: ModelRegistry;
  catalogPath: string;
}): Promise<unknown> {
  if (!input.apiKey) {
    throw new ChatError(
      "configuration",
      "NVIDIA_API_KEY is not configured. Set it in Parameters → Provider or in the host environment.",
    );
  }
  const remote = await fetchNvidiaCatalog(input.apiKey, { fetch: input.fetch });
  const local = new Set(mergedModels(input.registry, input.catalogPath).map((m) => m.id));
  return {
    source: "https://integrate.api.nvidia.com/v1/models",
    browse: "https://build.nvidia.com/models?filters=nimType%3Anim_type_preview",
    note: "NVIDIA Build Free Endpoint models are hosted NIMs billed against your NGC credits. Quota is not unlimited.",
    models: remote.map((entry) => ({
      id: entry.id,
      ownedBy: entry.ownedBy,
      added: local.has(entry.id),
    })),
  };
}

export function handleNvidiaCatalogAdd(
  catalogPath: string,
  body: unknown,
): UserChatModel {
  if (!isRecord(body) || typeof body.id !== "string" || body.id.trim().length === 0) {
    throw new ChatError("configuration", "id is required to add a model.");
  }
  const model: UserChatModel = {
    id: body.id.trim(),
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : body.id.trim(),
    provider: typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : "nvidia",
    inputModalities: ["text"],
  };
  const next = addUserChatModel(loadUserCatalog(catalogPath), model);
  saveUserCatalog(catalogPath, next);
  return model;
}

export function handleNvidiaCatalogRemove(catalogPath: string, id: string): void {
  if (!id.trim()) throw new ChatError("configuration", "id is required to remove a model.");
  saveUserCatalog(catalogPath, removeUserChatModel(loadUserCatalog(catalogPath), id.trim()));
}

export async function handleImageGenerate(input: {
  apiKey: string | undefined;
  fetch: FetchLike;
  catalogPath: string;
  storeRoot: string | undefined;
  body: unknown;
}): Promise<{
  locator: string;
  sha256: string;
  bytes: number;
  mediaType: string;
  filename: string;
}> {
  if (!input.apiKey) {
    throw new ChatError(
      "configuration",
      "NVIDIA_API_KEY is not configured. Set it in Parameters → Provider.",
    );
  }
  if (!input.storeRoot) {
    throw new ChatError("configuration", "A008_SOURCE_STORE_PATH is required to store generated images.");
  }
  if (!isRecord(input.body) || typeof input.body.prompt !== "string") {
    throw new ChatError("configuration", "prompt must be a string.");
  }
  const catalog = loadUserCatalog(input.catalogPath);
  const transport = new NvidiaImageTransport({
    apiKey: input.apiKey,
    endpoint: catalog.image.endpoint,
    fetch: input.fetch,
  });
  const generated = await transport.generate({
    prompt: input.body.prompt,
    ...(typeof input.body.width === "number" ? { width: input.body.width } : {}),
    ...(typeof input.body.height === "number" ? { height: input.body.height } : {}),
    ...(typeof input.body.seed === "number" ? { seed: input.body.seed } : {}),
  });
  const sha256 = createHash("sha256").update(generated.bytes).digest("hex");
  const filename = sanitiseUploadFilename(
    generated.mediaType === "image/jpeg" ? "generated.jpg" : "generated.png",
  );
  const stored = writeBlob(input.storeRoot, sha256, filename, generated.bytes);
  return {
    locator: stored.locator,
    sha256,
    bytes: generated.bytes.length,
    mediaType: generated.mediaType,
    filename,
  };
}

export function handleBlobGet(
  storeRoot: string | undefined,
  sha256: string,
  filename: string,
  response: ServerResponse,
): boolean {
  if (!storeRoot || !/^[a-f0-9]{64}$/u.test(sha256)) return false;
  const safeName = sanitiseUploadFilename(filename);
  const path = blobPath(storeRoot, sha256, safeName);
  if (!existsSync(path) || !statSync(path).isFile()) return false;
  const type = safeName.endsWith(".jpg") || safeName.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  response.writeHead(200, {
    "content-type": type,
    "cache-control": "private, max-age=31536000, immutable",
  });
  createReadStream(path).pipe(response);
  return true;
}

export function providerSettingsView(catalogPath: string, secretsPath: string, env: NodeJS.ProcessEnv) {
  const catalog = loadUserCatalog(catalogPath);
  const key = resolveNvidiaApiKey(env, secretsPath);
  return {
    nvidiaApiKeyConfigured: Boolean(key),
    imageModel: catalog.image.model,
    imageEndpoint: catalog.image.endpoint,
    keySource: env.NVIDIA_API_KEY?.trim() ? "environment" : key ? "secrets-file" : "missing",
  };
}

export function handleProviderSettingsPost(input: {
  catalogPath: string;
  secretsPath: string;
  env: NodeJS.ProcessEnv;
  body: unknown;
}): ReturnType<typeof providerSettingsView> {
  if (!isRecord(input.body)) {
    throw new ChatError("configuration", "Provider settings must be a JSON object.");
  }
  if (typeof input.body.nvidiaApiKey === "string") {
    const key = input.body.nvidiaApiKey.trim();
    if (key.length === 0) {
      throw new ChatError("configuration", "nvidiaApiKey must be non-empty when provided.");
    }
    const current = loadProviderSecrets(input.secretsPath);
    saveProviderSecrets(input.secretsPath, { ...current, nvidiaApiKey: key });
  }
  if (
    typeof input.body.imageModel === "string" ||
    typeof input.body.imageEndpoint === "string"
  ) {
    const catalog = loadUserCatalog(input.catalogPath);
    saveUserCatalog(input.catalogPath, {
      ...catalog,
      image: {
        model:
          typeof input.body.imageModel === "string" && input.body.imageModel.trim()
            ? input.body.imageModel.trim()
            : catalog.image.model,
        endpoint:
          typeof input.body.imageEndpoint === "string" && input.body.imageEndpoint.trim()
            ? input.body.imageEndpoint.trim()
            : catalog.image.endpoint,
      },
    });
  }
  return providerSettingsView(input.catalogPath, input.secretsPath, input.env);
}
