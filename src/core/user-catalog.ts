import type { UserChatModel } from "../../packages/protocol/src/index.js";
import type { McpServer } from "@agentclientprotocol/sdk";
export type { UserChatModel } from "../../packages/protocol/src/index.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { ChatError } from "./errors.js";
import { catalogExecutionProvider } from "./execution-provider.js";
import { ModelRegistry } from "./model-registry.js";
import type {
  ChatGenerationOptions,
  ModelModality,
  ModelProfile,
} from "./types.js";
import {
  DEFAULT_IMAGE_MODEL,
  NVIDIA_IMAGE_GENERATE_URL,
} from "../providers/nvidia/nvidia-image-transport.js";
import {
  DEFAULT_KIE_CHAT_MODEL,
  DEFAULT_KIE_IMAGE_MODEL,
  kieChatCompletionsUrl,
} from "../providers/kie/kie-models.js";
import {
  assertSupportedCompatibleRoute,
  isCompatibleExecutionProvider,
  normalizeProviderBaseUrl,
  type CompatibleApiStyle,
} from "../providers/compatible/provider-routes.js";

export const CATALOG_PATH_ENV = "A008_CATALOG_PATH";
export const DEFAULT_USER_IMAGE_MODEL = DEFAULT_IMAGE_MODEL;
export const DEFAULT_USER_IMAGE_ENDPOINT = NVIDIA_IMAGE_GENERATE_URL;

export interface UserImageSettings {
  readonly model: string;
  readonly endpoint: string;
}

export type CatalogProvider = "nvidia" | "kie";
export type ChatCatalogProvider = CatalogProvider | "openai";

export interface KieCatalogSettings {
  readonly chatModel: string;
  readonly chatEndpoint: string;
  readonly imageModel: string;
}

export type UserMcpServer = Extract<McpServer, { command: string }> & {
  readonly enabled: boolean;
};

export interface UserSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly sourcePath: string;
}

export interface UserCatalog {
  readonly version: 1;
  readonly mcpServers: readonly UserMcpServer[];
  readonly chatModels: readonly UserChatModel[];
  readonly skills: readonly UserSkill[];
  readonly image: UserImageSettings;
  readonly chatProvider: ChatCatalogProvider;
  readonly imageProvider: CatalogProvider;
  readonly kie: KieCatalogSettings;
}

const DEFAULT_KIE: KieCatalogSettings = {
  chatModel: DEFAULT_KIE_CHAT_MODEL,
  chatEndpoint: kieChatCompletionsUrl(DEFAULT_KIE_CHAT_MODEL),
  imageModel: DEFAULT_KIE_IMAGE_MODEL,
};

const EMPTY: UserCatalog = {
  version: 1,
  mcpServers: [],
  chatModels: [],
  skills: [],
  image: {
    model: DEFAULT_USER_IMAGE_MODEL,
    endpoint: DEFAULT_USER_IMAGE_ENDPOINT,
  },
  chatProvider: "nvidia",
  imageProvider: "nvidia",
  kie: DEFAULT_KIE,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function modality(value: unknown): value is ModelModality {
  return (
    value === "text" ||
    value === "image" ||
    value === "video" ||
    value === "audio"
  );
}

export function parseUserCatalog(value: unknown): UserCatalog {
  if (!isRecord(value) || value.version !== 1) {
    throw new ChatError(
      "configuration",
      "User catalog must be a version 1 document.",
    );
  }
  const mcpServers: UserMcpServer[] = [];
  if (value.mcpServers !== undefined) {
    if (!Array.isArray(value.mcpServers)) {
      throw new ChatError("configuration", "MCP servers must be an array.");
    }
    const names = new Set<string>();
    for (const item of value.mcpServers) {
      if (
        !isRecord(item) ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        typeof item.command !== "string" ||
        !item.command.trim() ||
        !Array.isArray(item.args) ||
        !item.args.every((arg) => typeof arg === "string") ||
        !Array.isArray(item.env) ||
        !item.env.every(
          (entry) =>
            isRecord(entry) &&
            typeof entry.name === "string" &&
            entry.name.trim() &&
            typeof entry.value === "string",
        ) ||
        (item.enabled !== undefined && typeof item.enabled !== "boolean")
      ) {
        throw new ChatError(
          "configuration",
          "MCP server is malformed or unsupported.",
        );
      }
      const name = item.name.trim();
      if (names.has(name)) {
        throw new ChatError(
          "configuration",
          "MCP server names must be unique.",
        );
      }
      names.add(name);
      mcpServers.push({
        name,
        command: item.command.trim(),
        args: [...item.args],
        env: item.env.map((entry) => ({
          name: String(entry.name).trim(),
          value: String(entry.value),
        })),
        enabled: item.enabled !== false,
      });
    }
  }
  const skills: UserSkill[] = [];
  if (value.skills !== undefined) {
    if (!Array.isArray(value.skills)) {
      throw new ChatError("configuration", "Skills must be an array.");
    }
    const ids = new Set<string>();
    for (const item of value.skills) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        !/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(item.id) ||
        ids.has(item.id) ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        typeof item.description !== "string" ||
        typeof item.instructions !== "string" ||
        item.instructions.length === 0 ||
        item.instructions.length > 65_536 ||
        typeof item.sourcePath !== "string" ||
        !/^skills\/[a-z0-9][a-z0-9_-]{0,63}\/SKILL\.md$/u.test(item.sourcePath)
      ) {
        throw new ChatError("configuration", "Skill is malformed or unsupported.");
      }
      ids.add(item.id);
      skills.push({
        id: item.id,
        name: item.name.trim(),
        description: item.description.trim(),
        instructions: item.instructions,
        sourcePath: item.sourcePath,
      });
    }
  }
  const image = isRecord(value.image)
    ? {
        model:
          typeof value.image.model === "string" && value.image.model.trim()
            ? value.image.model.trim()
            : DEFAULT_USER_IMAGE_MODEL,
        endpoint:
          typeof value.image.endpoint === "string" &&
          value.image.endpoint.trim()
            ? value.image.endpoint.trim()
            : DEFAULT_USER_IMAGE_ENDPOINT,
      }
    : EMPTY.image;
  const chatModels: UserChatModel[] = [];
  if (value.chatModels !== undefined) {
    if (!Array.isArray(value.chatModels)) {
      throw new ChatError(
        "configuration",
        "User catalog chatModels must be an array.",
      );
    }
    for (const item of value.chatModels) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        item.id.trim().length === 0 ||
        typeof item.name !== "string" ||
        typeof item.provider !== "string"
      ) {
        throw new ChatError(
          "configuration",
          "User catalog chat model is malformed.",
        );
      }
      const modalities = Array.isArray(item.inputModalities)
        ? item.inputModalities.filter(modality)
        : (["text"] as const);
      const provider = item.provider.trim().toLowerCase() || "nvidia";
      const executionProvider = catalogExecutionProvider(provider);
      const route =
        isCompatibleExecutionProvider(executionProvider)
          ? (() => {
              if (
                typeof item.baseUrl !== "string" ||
                !item.baseUrl.trim() ||
                (item.apiStyle !== "openai-chat-completions" &&
                  item.apiStyle !== "openai-responses")
              ) {
                throw new ChatError(
                  "configuration",
                  `User catalog model ${item.id.trim()} requires explicit baseUrl and apiStyle.`,
                );
              }
              const apiStyle = item.apiStyle as CompatibleApiStyle;
              assertSupportedCompatibleRoute({
                provider: executionProvider,
                baseUrl: item.baseUrl,
                apiStyle,
              });
              return {
                baseUrl: normalizeProviderBaseUrl(item.baseUrl),
                apiStyle,
              };
            })()
          : (() => {
              if (item.baseUrl !== undefined || item.apiStyle !== undefined) {
                throw new ChatError(
                  "configuration",
                  `User catalog model ${item.id.trim()} has route metadata on non-compatible provider ${provider}.`,
                );
              }
              return {};
            })();
      chatModels.push({
        id: item.id.trim(),
        name: item.name.trim() || item.id.trim(),
        provider,
        inputModalities: modalities.length > 0 ? modalities : ["text"],
        ...route,
      });
    }
  }
  const imageProvider = (value: unknown): CatalogProvider =>
    value === "kie" ? "kie" : "nvidia";
  const chatProvider = (value: unknown): ChatCatalogProvider =>
    value === "kie" || value === "openai" ? value : "nvidia";
  const kieRaw = isRecord(value.kie) ? value.kie : {};
  const kie: KieCatalogSettings = {
    chatModel:
      typeof kieRaw.chatModel === "string" && kieRaw.chatModel.trim()
        ? kieRaw.chatModel.trim()
        : DEFAULT_KIE.chatModel,
    chatEndpoint:
      typeof kieRaw.chatEndpoint === "string" && kieRaw.chatEndpoint.trim()
        ? kieRaw.chatEndpoint.trim()
        : DEFAULT_KIE.chatEndpoint,
    imageModel:
      typeof kieRaw.imageModel === "string" && kieRaw.imageModel.trim()
        ? kieRaw.imageModel.trim()
        : DEFAULT_KIE.imageModel,
  };
  return {
    version: 1,
    mcpServers,
    chatModels,
    skills,
    image,
    chatProvider: chatProvider(value.chatProvider),
    imageProvider: imageProvider(value.imageProvider),
    kie,
  };
}

export function userModelProfile(model: UserChatModel): ModelProfile {
  const defaults: ChatGenerationOptions = {
    temperature: 1,
    topP: 0.95,
    maxTokens: 16_384,
    stream: true,
  };
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    executionProvider: catalogExecutionProvider(model.provider),
    defaults,
    inputModalities: model.inputModalities,
  };
}

export function catalogBackedModelRegistry(
  base: ModelRegistry,
  catalogPath: string,
): ModelRegistry {
  return new ModelRegistry(base.list(), () => {
    try {
      return loadUserCatalog(catalogPath).chatModels.map(userModelProfile);
    } catch {
      return [];
    }
  });
}

export function defaultCatalogPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env[CATALOG_PATH_ENV]?.trim();
  return resolve(configured || join(homedir(), ".a008", "catalog.json"));
}

export function assertPathOutsideRepo(
  path: string,
  repoRoot: string,
  label: string,
): void {
  const within = relative(repoRoot, path);
  if (within === "" || (!within.startsWith("..") && !isAbsolute(within))) {
    throw new ChatError(
      "configuration",
      `${label} must be outside the A008 repository.`,
    );
  }
}

export function loadUserCatalog(path: string): UserCatalog {
  if (!existsSync(path)) return EMPTY;
  try {
    return parseUserCatalog(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError("configuration", "Cannot read the user model catalog.");
  }
}

export function saveUserCatalog(path: string, catalog: UserCatalog): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function activeMcpServers(catalog: UserCatalog): readonly McpServer[] {
  return catalog.mcpServers
    .filter((server) => server.enabled)
    .map(({ enabled: _, ...server }) => server);
}

export function replaceUserMcpServers(
  catalog: UserCatalog,
  mcpServers: readonly UserMcpServer[],
): UserCatalog {
  return { ...catalog, mcpServers: [...mcpServers] };
}

export function replaceUserSkills(
  catalog: UserCatalog,
  skills: readonly UserSkill[],
): UserCatalog {
  return { ...catalog, skills: [...skills] };
}

export function addUserSkill(
  catalog: UserCatalog,
  skill: UserSkill,
): UserCatalog {
  return replaceUserSkills(catalog, [
    ...catalog.skills.filter((entry) => entry.id !== skill.id),
    skill,
  ]);
}

export function removeUserSkill(
  catalog: UserCatalog,
  id: string,
): UserCatalog {
  return replaceUserSkills(catalog, catalog.skills.filter((entry) => entry.id !== id));
}

export function addUserChatModel(
  catalog: UserCatalog,
  model: UserChatModel,
): UserCatalog {
  const rest = catalog.chatModels.filter((entry) => entry.id !== model.id);
  return { ...catalog, chatModels: [...rest, model] };
}

export function removeUserChatModel(
  catalog: UserCatalog,
  id: string,
): UserCatalog {
  return {
    ...catalog,
    chatModels: catalog.chatModels.filter((entry) => entry.id !== id),
  };
}
