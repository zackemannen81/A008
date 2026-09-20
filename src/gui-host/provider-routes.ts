import type {
  NvidiaCatalog,
  KieCatalog,
  GeneratedImage,
  ProviderSettings,
  HostModel,
} from "../../packages/protocol/src/index.js";
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
  resolveKieApiKey,
  resolveNvidiaApiKey,
  resolveOpenAiApiKey,
  saveProviderSecrets,
} from "../core/provider-secrets.js";
import {
  activeMcpServers,
  addUserChatModel,
  loadUserCatalog,
  parseUserCatalog,
  removeUserChatModel,
  replaceUserMcpServers,
  saveUserCatalog,
  userModelProfile,
  type CatalogProvider,
  type ChatCatalogProvider,
  type UserChatModel,
} from "../core/user-catalog.js";
import { fetchNvidiaCatalog } from "../providers/nvidia/nvidia-catalog.js";
import { NvidiaImageTransport } from "../providers/nvidia/nvidia-image-transport.js";
import { KieJobTransport } from "../providers/kie/kie-jobs.js";
import { KIE_MARKET_MODELS } from "../providers/kie/kie-models.js";
import { blobPath, sanitiseUploadFilename, writeBlob } from "./source-store.js";

export type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mcpServersView(catalogPath: string): {
  servers: readonly import("../core/user-catalog.js").UserMcpServer[];
} {
  return { servers: loadUserCatalog(catalogPath).mcpServers };
}

export function handleMcpServersPost(
  catalogPath: string,
  body: unknown,
): ReturnType<typeof mcpServersView> {
  if (!isRecord(body) || !Array.isArray(body.servers)) {
    throw new ChatError("configuration", "MCP servers must be an array.");
  }
  const parsed = parseUserCatalog({
    ...loadUserCatalog(catalogPath),
    mcpServers: body.servers,
  });
  saveUserCatalog(
    catalogPath,
    replaceUserMcpServers(loadUserCatalog(catalogPath), parsed.mcpServers),
  );
  return mcpServersView(catalogPath);
}

export function configuredMcpServers(catalogPath: string) {
  return activeMcpServers(loadUserCatalog(catalogPath));
}

export function mergedModels(
  registry: ModelRegistry,
  catalogPath: string,
): HostModel[] {
  const extras = loadUserCatalog(catalogPath).chatModels.map(userModelProfile);
  const seen = new Set(registry.list().map((profile) => profile.id));
  return [
    ...registry.list(),
    ...extras.filter((profile) => !seen.has(profile.id)),
  ].map((profile) => ({
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    executionProvider: profile.executionProvider ?? profile.provider,
    inputModalities: [...profile.inputModalities],
    ...(profile.verifiedOn === undefined
      ? {}
      : { verifiedOn: profile.verifiedOn }),
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
}): Promise<NvidiaCatalog> {
  if (!input.apiKey) {
    throw new ChatError(
      "configuration",
      "NVIDIA_API_KEY is not configured. Set it in Parameters → Provider or in the host environment.",
    );
  }
  const remote = await fetchNvidiaCatalog(input.apiKey, { fetch: input.fetch });
  const local = new Set(
    mergedModels(input.registry, input.catalogPath).map((m) => m.id),
  );
  return {
    source: "https://integrate.api.nvidia.com/v1/models",
    browse:
      "https://build.nvidia.com/models?filters=nimType%3Anim_type_preview",
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
  if (
    !isRecord(body) ||
    typeof body.id !== "string" ||
    body.id.trim().length === 0
  ) {
    throw new ChatError("configuration", "id is required to add a model.");
  }
  const model: UserChatModel = {
    id: body.id.trim(),
    name:
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : body.id.trim(),
    provider:
      typeof body.provider === "string" && body.provider.trim()
        ? body.provider.trim()
        : "nvidia",
    inputModalities: ["text"],
  };
  const next = addUserChatModel(loadUserCatalog(catalogPath), model);
  saveUserCatalog(catalogPath, next);
  return model;
}

export function handleNvidiaCatalogRemove(
  catalogPath: string,
  id: string,
): void {
  if (!id.trim())
    throw new ChatError("configuration", "id is required to remove a model.");
  saveUserCatalog(
    catalogPath,
    removeUserChatModel(loadUserCatalog(catalogPath), id.trim()),
  );
}

export function handleKieCatalogGet(catalogPath: string): KieCatalog {
  const catalog = loadUserCatalog(catalogPath);
  const added = new Set(catalog.chatModels.map((model) => model.id));
  return {
    source: "https://docs.kie.ai/",
    browse: "https://kie.ai/market",
    note: "kie.ai is an aggregator. Chat uses OpenAI-compatible completions; images use async Market jobs. Media URLs expire; A008 stores a local copy.",
    models: KIE_MARKET_MODELS.map((model) => ({
      id: model.id,
      kind: model.kind,
      name: model.name,
      added: added.has(model.id) || catalog.kie.imageModel === model.id,
    })),
  };
}

export async function handleImageGenerate(input: {
  apiKey: string | undefined;
  kieApiKey: string | undefined;
  fetch: FetchLike;
  catalogPath: string;
  storeRoot: string | undefined;
  body: unknown;
}): Promise<GeneratedImage> {
  if (!input.storeRoot) {
    throw new ChatError(
      "configuration",
      "A008_SOURCE_STORE_PATH is required to store generated images.",
    );
  }
  if (!isRecord(input.body) || typeof input.body.prompt !== "string") {
    throw new ChatError("configuration", "prompt must be a string.");
  }
  const prompt = input.body.prompt;
  const width = input.body.width;
  const height = input.body.height;
  const seed = input.body.seed;
  const catalog = loadUserCatalog(input.catalogPath);
  const generated =
    catalog.imageProvider === "kie"
      ? await (async () => {
          if (!input.kieApiKey) {
            throw new ChatError(
              "configuration",
              "KIE_API_KEY is not configured. Set it in Parameters → Provider.",
            );
          }
          return new KieJobTransport({
            apiKey: input.kieApiKey,
            fetch: input.fetch,
          }).generateImage(catalog.kie.imageModel, prompt);
        })()
      : await (async () => {
          if (!input.apiKey) {
            throw new ChatError(
              "configuration",
              "NVIDIA_API_KEY is not configured. Set it in Parameters → Provider.",
            );
          }
          return new NvidiaImageTransport({
            apiKey: input.apiKey,
            endpoint: catalog.image.endpoint,
            fetch: input.fetch,
          }).generate({
            prompt,
            ...(typeof width === "number" ? { width } : {}),
            ...(typeof height === "number" ? { height } : {}),
            ...(typeof seed === "number" ? { seed } : {}),
          });
        })();
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
  const type =
    safeName.endsWith(".jpg") || safeName.endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png";
  response.writeHead(200, {
    "content-type": type,
    "cache-control": "private, max-age=31536000, immutable",
  });
  createReadStream(path).pipe(response);
  return true;
}

export function providerSettingsView(
  catalogPath: string,
  secretsPath: string,
  env: NodeJS.ProcessEnv,
): ProviderSettings {
  const catalog = loadUserCatalog(catalogPath);
  const nvidia = resolveNvidiaApiKey(env, secretsPath);
  const kie = resolveKieApiKey(env, secretsPath);
  const openAi = resolveOpenAiApiKey(env, secretsPath);
  return {
    nvidiaApiKeyConfigured: Boolean(nvidia),
    kieApiKeyConfigured: Boolean(kie),
    openAiApiKeyConfigured: Boolean(openAi),
    imageModel: catalog.image.model,
    imageEndpoint: catalog.image.endpoint,
    chatProvider: catalog.chatProvider,
    imageProvider: catalog.imageProvider,
    kieChatModel: catalog.kie.chatModel,
    kieChatEndpoint: catalog.kie.chatEndpoint,
    kieImageModel: catalog.kie.imageModel,
    keySource: env.NVIDIA_API_KEY?.trim()
      ? "environment"
      : nvidia
        ? "secrets-file"
        : "missing",
    kieKeySource: env.KIE_API_KEY?.trim()
      ? "environment"
      : kie
        ? "secrets-file"
        : "missing",
    openAiKeySource: env.OPENAI_API_KEY?.trim()
      ? "environment"
      : openAi
        ? "secrets-file"
        : "missing",
  };
}

export function handleProviderSettingsPost(input: {
  catalogPath: string;
  secretsPath: string;
  env: NodeJS.ProcessEnv;
  body: unknown;
}): ReturnType<typeof providerSettingsView> {
  if (!isRecord(input.body)) {
    throw new ChatError(
      "configuration",
      "Provider settings must be a JSON object.",
    );
  }
  const currentSecrets = loadProviderSecrets(input.secretsPath);
  let nvidiaApiKey = currentSecrets.nvidiaApiKey;
  let kieApiKey = currentSecrets.kieApiKey;
  let openAiApiKey = currentSecrets.openAiApiKey;
  if (typeof input.body.nvidiaApiKey === "string") {
    const key = input.body.nvidiaApiKey.trim();
    if (key.length === 0) {
      throw new ChatError(
        "configuration",
        "nvidiaApiKey must be non-empty when provided.",
      );
    }
    nvidiaApiKey = key;
  }
  if (typeof input.body.kieApiKey === "string") {
    const key = input.body.kieApiKey.trim();
    if (key.length === 0) {
      throw new ChatError(
        "configuration",
        "kieApiKey must be non-empty when provided.",
      );
    }
    kieApiKey = key;
  }
  if (typeof input.body.openAiApiKey === "string") {
    const key = input.body.openAiApiKey.trim();
    if (key.length === 0) {
      throw new ChatError(
        "configuration",
        "openAiApiKey must be non-empty when provided.",
      );
    }
    openAiApiKey = key;
  }
  if (
    nvidiaApiKey !== currentSecrets.nvidiaApiKey ||
    kieApiKey !== currentSecrets.kieApiKey ||
    openAiApiKey !== currentSecrets.openAiApiKey
  ) {
    saveProviderSecrets(input.secretsPath, {
      nvidiaApiKey,
      kieApiKey,
      openAiApiKey,
    });
  }
  const catalog = loadUserCatalog(input.catalogPath);
  const asChatProvider = (value: unknown): ChatCatalogProvider | undefined =>
    value === "kie" || value === "nvidia" || value === "openai"
      ? value
      : undefined;
  const asImageProvider = (value: unknown): CatalogProvider | undefined =>
    value === "kie" || value === "nvidia" ? value : undefined;
  saveUserCatalog(input.catalogPath, {
    ...catalog,
    chatProvider:
      asChatProvider(input.body.chatProvider) ?? catalog.chatProvider,
    imageProvider:
      asImageProvider(input.body.imageProvider) ?? catalog.imageProvider,
    image: {
      model:
        typeof input.body.imageModel === "string" &&
        input.body.imageModel.trim()
          ? input.body.imageModel.trim()
          : catalog.image.model,
      endpoint:
        typeof input.body.imageEndpoint === "string" &&
        input.body.imageEndpoint.trim()
          ? input.body.imageEndpoint.trim()
          : catalog.image.endpoint,
    },
    kie: {
      chatModel:
        typeof input.body.kieChatModel === "string" &&
        input.body.kieChatModel.trim()
          ? input.body.kieChatModel.trim()
          : catalog.kie.chatModel,
      chatEndpoint:
        typeof input.body.kieChatEndpoint === "string" &&
        input.body.kieChatEndpoint.trim()
          ? input.body.kieChatEndpoint.trim()
          : catalog.kie.chatEndpoint,
      imageModel:
        typeof input.body.kieImageModel === "string" &&
        input.body.kieImageModel.trim()
          ? input.body.kieImageModel.trim()
          : catalog.kie.imageModel,
    },
  });
  return providerSettingsView(input.catalogPath, input.secretsPath, input.env);
}
