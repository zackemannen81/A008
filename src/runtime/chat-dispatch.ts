import { ChatError } from "../core/errors.js";
import { resolveExecutionProvider } from "../core/execution-provider.js";
import type { ModelRegistry } from "../core/model-registry.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatRequest,
  ChatTransport,
} from "../core/types.js";
import { loadUserCatalog, type UserCatalog } from "../core/user-catalog.js";
import {
  AcmeChatTransport,
  type AcmeChatTransportOptions,
} from "../providers/acme/acme-chat-transport.js";
import {
  createEmbeddedAcmeChatTransport,
  type EmbeddedAcmeChatTransportOptions,
} from "../providers/acme/embedded-acme-chat-transport.js";
import {
  KieChatTransport,
  type FetchLike,
} from "../providers/kie/kie-chat-transport.js";
import { isKieChatModelId } from "../providers/kie/kie-models.js";
import { NvidiaChatTransport } from "../providers/nvidia/nvidia-chat-transport.js";
import { OpenAiChatTransport } from "../providers/openai/openai-chat-transport.js";
import { OpenAiCompatibleChatTransport } from "../providers/compatible/openai-compatible-chat-transport.js";
import {
  compatibleCredentialEnv,
  isCompatibleExecutionProvider,
} from "../providers/compatible/provider-routes.js";
import type { AcmeRuntimeSelection } from "./local-runtime-config.js";
import { NVIDIA_ENDPOINT_ENV } from "./nvidia-session.js";

export function usesKieChat(model: string, catalogPath: string): boolean {
  const catalog = loadUserCatalog(catalogPath);
  if (isKieChatModelId(model)) return true;
  if (
    catalog.chatModels.some(
      (entry) => entry.id === model && entry.provider === "kie",
    )
  ) {
    return true;
  }
  return catalog.chatProvider === "kie";
}

function isKnownKieChatModel(model: string, catalog: UserCatalog): boolean {
  return (
    isKieChatModelId(model) ||
    catalog.chatModels.some(
      (entry) => entry.id === model && entry.provider === "kie",
    )
  );
}

function isKnownOpenAiChatModel(model: string, catalog: UserCatalog): boolean {
  return (
    model === "gpt-5.6-luna" ||
    model === "gpt-5.6-terra" ||
    catalog.chatModels.some(
      (entry) => entry.id === model && entry.provider === "openai",
    )
  );
}

export function usesOpenAiChat(model: string, catalogPath: string): boolean {
  const catalog = loadUserCatalog(catalogPath);
  return isKnownOpenAiChatModel(model, catalog);
}

export function usesEmbeddedAcmeChat(selection: AcmeRuntimeSelection): boolean {
  return selection.mode === "embedded-acme";
}

export function usesAcmeChat(selection: AcmeRuntimeSelection): boolean {
  return selection.mode === "acme";
}

export function createEmbeddedAcmeRuntimeChatTransport(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly catalogPath: string;
  readonly timeoutMs: number;
  readonly registry?: ModelRegistry;
  readonly fetch?: FetchLike;
  readonly requestKey?: EmbeddedAcmeChatTransportOptions["requestKey"];
}): ChatTransport {
  const nvidiaEndpoint = options.env[NVIDIA_ENDPOINT_ENV]?.trim();
  return createEmbeddedAcmeChatTransport({
    env: options.env,
    catalogPath: options.catalogPath,
    timeoutMs: options.timeoutMs,
    ...(nvidiaEndpoint ? { nvidiaEndpoint } : {}),
    ...(options.registry === undefined ? {} : { registry: options.registry }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.requestKey === undefined
      ? {}
      : { requestKey: options.requestKey }),
  });
}

export function createAcmeRuntimeChatTransport(options: {
  readonly selection: AcmeRuntimeSelection;
  readonly timeoutMs: number;
  readonly fetch?: FetchLike;
  readonly requestKey?: AcmeChatTransportOptions["requestKey"];
  readonly correlationId?: AcmeChatTransportOptions["correlationId"];
  readonly catalogPath?: string;
}): ChatTransport {
  if (
    options.selection.mode !== "acme" ||
    options.selection.baseUrl === undefined
  ) {
    throw new ChatError(
      "configuration",
      "ACME chat transport requires A008_CHAT_TRANSPORT=acme and A008_ACME_MODEL_RUNTIME_URL.",
    );
  }
  return new AcmeChatTransport({
    baseUrl: options.selection.baseUrl,
    timeoutMs: options.timeoutMs,
    ...(options.selection.token === undefined
      ? {}
      : { token: options.selection.token }),
    ...(options.selection.engineBuild === undefined
      ? {}
      : { engineBuild: options.selection.engineBuild }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.requestKey === undefined
      ? {}
      : { requestKey: options.requestKey }),
    ...(options.correlationId === undefined
      ? {}
      : { correlationId: options.correlationId }),
    ...(options.catalogPath === undefined
      ? {}
      : { catalogPath: options.catalogPath }),
  });
}

export function createConfiguredChatTransport(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly catalogPath: string;
  readonly timeoutMs: number;
  readonly fetch?: FetchLike;
  readonly registry?: ModelRegistry;
  readonly acme: AcmeRuntimeSelection;
}): ChatTransport {
  if (usesEmbeddedAcmeChat(options.acme)) {
    return createEmbeddedAcmeRuntimeChatTransport({
      env: options.env,
      catalogPath: options.catalogPath,
      timeoutMs: options.timeoutMs,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      ...(options.registry === undefined ? {} : { registry: options.registry }),
    });
  }
  if (usesAcmeChat(options.acme)) {
    return createAcmeRuntimeChatTransport({
      selection: options.acme,
      timeoutMs: options.timeoutMs,
      catalogPath: options.catalogPath,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
  }
  return createDispatchingChatTransport({
    env: options.env,
    catalogPath: options.catalogPath,
    timeoutMs: options.timeoutMs,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
}

export function createDispatchingChatTransport(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly catalogPath: string;
  readonly timeoutMs: number;
  readonly fetch?: FetchLike;
}): ChatTransport {
  return {
    complete(
      request: ChatRequest,
      callbacks?: ChatCallbacks,
    ): Promise<ChatCompletion> {
      const catalog = loadUserCatalog(options.catalogPath);
      const executionProvider =
        isKnownKieChatModel(request.model, catalog) ||
        catalog.chatProvider === "kie"
          ? "kie"
          : resolveExecutionProvider(request.model, catalog);

      switch (executionProvider) {
        case "openai": {
          const apiKey = options.env.OPENAI_API_KEY?.trim();
          if (!apiKey) {
            throw new ChatError(
              "configuration",
              "OPENAI_API_KEY is required for OpenAI chat.",
            );
          }
          return new OpenAiChatTransport({
            apiKey,
            timeoutMs: options.timeoutMs,
            ...(options.fetch ? { fetch: options.fetch } : {}),
          }).complete(request, callbacks);
        }
        case "kie": {
          const apiKey = options.env.KIE_API_KEY?.trim();
          if (!apiKey) {
            throw new ChatError(
              "configuration",
              "KIE_API_KEY is required for kie.ai chat.",
            );
          }
          const model = isKnownKieChatModel(request.model, catalog)
            ? request.model
            : catalog.kie.chatModel;
          const transport = new KieChatTransport({
            apiKey,
            timeoutMs: options.timeoutMs,
            ...(options.fetch ? { fetch: options.fetch } : {}),
          });
          return transport.complete(
            model === request.model
              ? request
              : {
                  model,
                  messages: request.messages,
                  ...(request.tools ? { tools: request.tools } : {}),
                  ...(request.options ? { options: request.options } : {}),
                  ...(request.signal ? { signal: request.signal } : {}),
                },
            callbacks,
          );
        }
        case "nvidia": {
          const apiKey = options.env.NVIDIA_API_KEY?.trim();
          if (!apiKey) {
            throw new ChatError(
              "configuration",
              "NVIDIA_API_KEY is required for NVIDIA chat.",
            );
          }
          const endpoint = options.env[NVIDIA_ENDPOINT_ENV]?.trim();
          return new NvidiaChatTransport({
            apiKey,
            timeoutMs: options.timeoutMs,
            ...(endpoint ? { endpoint } : {}),
            ...(options.fetch ? { fetch: options.fetch } : {}),
          }).complete(request, callbacks);
        }
        case "openrouter":
        case "groq":
        case "google":
        case "opencode": {
          if (!isCompatibleExecutionProvider(executionProvider)) {
            throw new ChatError(
              "configuration",
              `Unsupported compatible provider ${executionProvider}.`,
            );
          }
          const route = catalog.chatModels.find(
            (entry) =>
              entry.id === request.model &&
              entry.provider === executionProvider,
          );
          if (route === undefined) {
            throw new ChatError(
              "configuration",
              `No persisted ${executionProvider} route for model ${request.model}.`,
            );
          }
          const keyName = compatibleCredentialEnv(executionProvider);
          const apiKey = options.env[keyName]?.trim();
          if (!apiKey) {
            throw new ChatError(
              "configuration",
              `${keyName} is required for ${executionProvider} chat.`,
            );
          }
          return new OpenAiCompatibleChatTransport({
            provider: executionProvider,
            apiKey,
            route,
            catalog,
            timeoutMs: options.timeoutMs,
            ...(options.fetch ? { fetch: options.fetch } : {}),
          }).complete(request, callbacks);
        }
      }
    },
  };
}
