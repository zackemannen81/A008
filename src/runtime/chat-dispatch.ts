import { ChatError } from "../core/errors.js";
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
  const nvidiaKey = options.env.NVIDIA_API_KEY?.trim();
  const kieKey = options.env.KIE_API_KEY?.trim();
  const openAiKey = options.env.OPENAI_API_KEY?.trim();
  if (!nvidiaKey && !kieKey && !openAiKey) {
    throw new ChatError(
      "configuration",
      "NVIDIA_API_KEY, KIE_API_KEY, or OPENAI_API_KEY is required for chat.",
    );
  }
  const nvidiaEndpoint = options.env[NVIDIA_ENDPOINT_ENV]?.trim();
  const nvidia = nvidiaKey
    ? new NvidiaChatTransport({
        apiKey: nvidiaKey,
        timeoutMs: options.timeoutMs,
        ...(nvidiaEndpoint ? { endpoint: nvidiaEndpoint } : {}),
        ...(options.fetch ? { fetch: options.fetch } : {}),
      })
    : undefined;

  return {
    complete(
      request: ChatRequest,
      callbacks?: ChatCallbacks,
    ): Promise<ChatCompletion> {
      const catalog = loadUserCatalog(options.catalogPath);
      if (isKnownOpenAiChatModel(request.model, catalog)) {
        if (!openAiKey) {
          throw new ChatError(
            "configuration",
            "OPENAI_API_KEY is required for OpenAI chat.",
          );
        }
        const model = isKnownOpenAiChatModel(request.model, catalog)
          ? request.model
          : "gpt-5.6-luna";
        const transport = new OpenAiChatTransport({
          apiKey: openAiKey,
          timeoutMs: options.timeoutMs,
          ...(options.fetch ? { fetch: options.fetch } : {}),
        });
        return transport.complete(
          model === request.model ? request : { ...request, model },
          callbacks,
        );
      }
      if (usesKieChat(request.model, options.catalogPath)) {
        if (!kieKey) {
          throw new ChatError(
            "configuration",
            "KIE_API_KEY is required for kie.ai chat.",
          );
        }
        const catalog = loadUserCatalog(options.catalogPath);
        const model = isKnownKieChatModel(request.model, catalog)
          ? request.model
          : catalog.kie.chatModel;
        const transport = new KieChatTransport({
          apiKey: kieKey,
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
      if (!nvidia) {
        throw new ChatError(
          "configuration",
          "NVIDIA_API_KEY is required for NVIDIA chat.",
        );
      }
      return nvidia.complete(request, callbacks);
    },
  };
}
