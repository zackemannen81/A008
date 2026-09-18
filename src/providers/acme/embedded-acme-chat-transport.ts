import { randomUUID } from "node:crypto";
import { createAcmeModelRuntime, type AcmeModelRuntime } from "acme-engine";
import { ChatError, isChatError } from "../../core/errors.js";
import {
  acmeProviderHint,
  resolveExecutionProvider,
} from "../../core/execution-provider.js";
import { generationCapabilities } from "../../core/generation-controls.js";
import {
  defaultModelRegistry,
  type ModelRegistry,
} from "../../core/model-registry.js";
import {
  loadUserCatalog,
  userModelProfile,
  type UserCatalog,
} from "../../core/user-catalog.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatRequest,
  ChatTransport,
  ModelProfile,
} from "../../core/types.js";
import { KIE_MARKET_MODELS, kieChatCompletionsUrl } from "../kie/kie-models.js";
import { OPENAI_CHAT_COMPLETIONS_URL } from "../openai/openai-chat-transport.js";
import {
  buildAcmeExecuteBody,
  chatErrorFromAcmeFailure,
  completionFromAcmeResponse,
} from "./acme-model-runtime.js";

type RuntimeOptions = Parameters<typeof createAcmeModelRuntime>[0];
type RuntimeConfig = RuntimeOptions["config"];
type RuntimeFactory = (options: RuntimeOptions) => AcmeModelRuntime;
type ProviderTransport = NonNullable<
  RuntimeOptions["chatCompletionsTransport"]
>;
type ProviderTransportRequest = Parameters<ProviderTransport["send"]>[0];

export interface EmbeddedAcmeChatTransportOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly catalogPath: string;
  readonly timeoutMs?: number;
  readonly registry?: ModelRegistry;
  readonly fetch?: typeof globalThis.fetch;
  readonly requestKey?: () => string;
  readonly nvidiaEndpoint?: string;
  readonly runtimeFactory?: RuntimeFactory;
}

function mergedProfiles(
  registry: ModelRegistry,
  catalog: UserCatalog,
): readonly ModelProfile[] {
  const shipped = registry.list();
  const seen = new Set(shipped.map((profile) => profile.id));
  const extras = catalog.chatModels
    .map(userModelProfile)
    .filter((profile) => !seen.has(profile.id));
  for (const profile of extras) seen.add(profile.id);
  const kie = KIE_MARKET_MODELS.filter(
    (model) => model.kind === "chat" && !seen.has(model.id),
  ).map<ModelProfile>((model) => ({
    id: model.id,
    name: model.name,
    provider: "kie",
    executionProvider: "kie",
    defaults: { temperature: 1, topP: 0.95, maxTokens: 16_384, stream: true },
    inputModalities: ["text"],
  }));
  return [...shipped, ...extras, ...kie];
}

function modelCapabilities(profile: ModelProfile): {
  readonly structuredOutput: boolean;
  readonly tools: boolean;
  readonly vision: boolean;
  readonly maxOutputTokens: number;
} {
  const executionProvider = profile.executionProvider ?? "nvidia";
  return {
    structuredOutput: false,
    tools: executionProvider !== "kie",
    vision:
      executionProvider !== "kie" && profile.inputModalities.includes("image"),
    maxOutputTokens: generationCapabilities(profile.id).maxTokens,
  };
}

function chatControls(profile: ModelProfile): {
  readonly temperature: true;
  readonly topP: boolean;
  readonly maxOutputTokens: true;
  readonly stop: boolean;
  readonly reasoningBudget: boolean;
  readonly enableThinking: "enable_thinking" | "thinking" | false;
  readonly reasoningEffort: boolean;
  readonly seed: boolean;
} {
  const caps = generationCapabilities(profile.id);
  return {
    temperature: true,
    topP: caps.topP,
    maxOutputTokens: true,
    stop: caps.stop,
    reasoningBudget: caps.reasoningBudget !== null,
    enableThinking: caps.thinking
      ? profile.id === "deepseek-ai/deepseek-v4-pro-0813"
        ? "thinking"
        : "enable_thinking"
      : false,
    reasoningEffort: caps.reasoningEfforts.length > 0,
    seed: caps.seed,
  };
}

function selection(profile: ModelProfile): {
  readonly profile: string;
  readonly providerHint: string;
  readonly modelHint: string;
} {
  const executionProvider = profile.executionProvider ?? "nvidia";
  return {
    profile: profile.id,
    providerHint: acmeProviderHint(executionProvider, profile.id),
    modelHint: profile.id,
  };
}

function requireKey(
  env: NodeJS.ProcessEnv,
  name: "NVIDIA_API_KEY" | "OPENAI_API_KEY" | "KIE_API_KEY",
): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

export function buildEmbeddedAcmeRuntimeConfig(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly catalog: UserCatalog;
  readonly registry?: ModelRegistry;
  readonly nvidiaEndpoint?: string;
}): RuntimeConfig {
  const registry = options.registry ?? defaultModelRegistry;
  const profiles = mergedProfiles(registry, options.catalog);
  const nvidiaKey = requireKey(options.env, "NVIDIA_API_KEY");
  const openAiKey = requireKey(options.env, "OPENAI_API_KEY");
  const kieKey = requireKey(options.env, "KIE_API_KEY");

  const nvidiaProfiles = profiles
    .filter(
      (profile) =>
        resolveExecutionProvider(profile.id, options.catalog) === "nvidia",
    )
    .map((profile) => ({
      selection: selection(profile),
      model: profile.id,
      capabilities: modelCapabilities(profile),
      controls: chatControls(profile),
    }));

  const openAiProfiles = profiles
    .filter(
      (profile) =>
        resolveExecutionProvider(profile.id, options.catalog) === "openai",
    )
    .map((profile) => ({
      selection: selection(profile),
      model: profile.id,
      capabilities: modelCapabilities(profile),
      controls: chatControls(profile),
      maxOutputTokensParameter: "max_completion_tokens" as const,
    }));

  const kieProfiles = profiles.filter(
    (profile) =>
      resolveExecutionProvider(profile.id, options.catalog) === "kie",
  );

  const openAiCompatible =
    openAiKey === undefined || openAiProfiles.length === 0
      ? []
      : [
          {
            providerHint: "openai",
            endpoint: OPENAI_CHAT_COMPLETIONS_URL,
            apiKey: openAiKey,
            provider: "openai",
            profiles: openAiProfiles,
          },
        ];
  const kieCompatible =
    kieKey === undefined
      ? []
      : kieProfiles.map((profile) => ({
          providerHint: acmeProviderHint("kie", profile.id),
          endpoint:
            profile.id === options.catalog.kie.chatModel
              ? options.catalog.kie.chatEndpoint
              : kieChatCompletionsUrl(profile.id),
          apiKey: kieKey,
          provider: "kie",
          profiles: [
            {
              selection: selection(profile),
              model: profile.id,
              capabilities: modelCapabilities(profile),
              controls: {
                temperature: true,
                topP: true,
                maxOutputTokens: true,
                stop: false,
                reasoningBudget: false,
                enableThinking: false as const,
                reasoningEffort: false,
                seed: false,
              },
            },
          ],
        }));
  const compatible = [...openAiCompatible, ...kieCompatible];

  const config: RuntimeConfig = {
    ...(nvidiaKey !== undefined && nvidiaProfiles.length > 0
      ? {
          nvidia: {
            apiKey: nvidiaKey,
            ...(options.nvidiaEndpoint === undefined
              ? {}
              : { endpoint: options.nvidiaEndpoint }),
            profiles: nvidiaProfiles,
          },
        }
      : {}),
    ...(compatible.length > 0 ? { compatible } : {}),
  };

  if (config.nvidia === undefined && config.compatible === undefined) {
    throw new ChatError(
      "configuration",
      "NVIDIA_API_KEY, OPENAI_API_KEY, or KIE_API_KEY is required for embedded ACME chat.",
    );
  }
  return config;
}

function headerRecord(headers: Headers): Readonly<Record<string, string>> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return Object.freeze(record);
}

function transportFailureReason(
  error: unknown,
  timedOut: boolean,
): "timeout" | "aborted" | "network" {
  if (timedOut) return "timeout";
  if (error instanceof Error && error.name === "AbortError") return "aborted";
  return "network";
}

function createA008FetchTransport(
  fetchImpl: typeof globalThis.fetch,
): ProviderTransport {
  return {
    async send(request: ProviderTransportRequest) {
      if (request.signal.aborted) {
        return {
          kind: "no-response",
          reason: "aborted",
          delivery: "not-sent",
          message: "The call was cancelled before dispatch.",
        };
      }
      const timeout = AbortSignal.timeout(request.timeoutMs);
      const signal = AbortSignal.any([request.signal, timeout]);
      try {
        const response = await fetchImpl(request.url, {
          method: request.method,
          headers: { ...request.headers },
          body: request.body,
          signal,
        });
        return {
          kind: "response",
          status: response.status,
          headers: headerRecord(response.headers),
          body: await response.text(),
        };
      } catch (error) {
        return {
          kind: "no-response",
          reason: transportFailureReason(error, timeout.aborted),
          delivery: "unknown",
          message:
            error instanceof Error ? error.message : "The transport failed.",
        };
      }
    },
    async *stream(request: ProviderTransportRequest) {
      if (request.signal.aborted) {
        yield {
          kind: "no-response",
          reason: "aborted",
          delivery: "not-sent",
          message: "The call was cancelled before dispatch.",
        };
        return;
      }
      const timeout = AbortSignal.timeout(request.timeoutMs);
      const signal = AbortSignal.any([request.signal, timeout]);
      let response: Response;
      try {
        response = await fetchImpl(request.url, {
          method: request.method,
          headers: { ...request.headers },
          body: request.body,
          signal,
        });
      } catch (error) {
        yield {
          kind: "no-response",
          reason: transportFailureReason(error, timeout.aborted),
          delivery: "unknown",
          message:
            error instanceof Error ? error.message : "The transport failed.",
        };
        return;
      }

      yield {
        kind: "response-start",
        status: response.status,
        headers: headerRecord(response.headers),
      };
      if (response.body === null) {
        yield { kind: "response-end" };
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield {
            kind: "chunk",
            text: decoder.decode(value, { stream: true }),
          };
        }
        const tail = decoder.decode();
        if (tail.length > 0) yield { kind: "chunk", text: tail };
        yield { kind: "response-end" };
      } catch (error) {
        yield {
          kind: "no-response",
          reason: transportFailureReason(error, timeout.aborted),
          delivery: "unknown",
          message:
            error instanceof Error ? error.message : "The transport failed.",
        };
      } finally {
        reader.releaseLock();
      }
    },
  };
}

function catalogFingerprint(
  catalog: UserCatalog,
  registry: ModelRegistry,
): string {
  return JSON.stringify({
    chatModels: catalog.chatModels,
    kie: catalog.kie,
    profiles: registry.list().map((profile) => ({
      id: profile.id,
      executionProvider: profile.executionProvider,
      inputModalities: profile.inputModalities,
    })),
  });
}

function executionRequest(
  body: Record<string, unknown>,
): Parameters<AcmeModelRuntime["execute"]>[0] {
  const request = { ...body };
  delete request.protocolVersion;
  delete request.correlationId;
  return request as unknown as Parameters<AcmeModelRuntime["execute"]>[0];
}

export class EmbeddedAcmeChatTransport implements ChatTransport {
  readonly #env: NodeJS.ProcessEnv;
  readonly #catalogPath: string;
  readonly #timeoutMs: number;
  readonly #registry: ModelRegistry;
  readonly #requestKey: () => string;
  readonly #nvidiaEndpoint: string | undefined;
  readonly #runtimeFactory: RuntimeFactory;
  readonly #providerTransport: ProviderTransport;
  #runtime: AcmeModelRuntime | undefined;
  #fingerprint: string | undefined;

  constructor(options: EmbeddedAcmeChatTransportOptions) {
    this.#env = options.env;
    this.#catalogPath = options.catalogPath;
    this.#timeoutMs = options.timeoutMs ?? 180_000;
    this.#registry = options.registry ?? defaultModelRegistry;
    this.#requestKey = options.requestKey ?? randomUUID;
    this.#nvidiaEndpoint = options.nvidiaEndpoint;
    this.#runtimeFactory = options.runtimeFactory ?? createAcmeModelRuntime;
    this.#providerTransport = createA008FetchTransport(
      options.fetch ?? globalThis.fetch.bind(globalThis),
    );
  }

  #runtimeFor(catalog: UserCatalog): AcmeModelRuntime {
    const fingerprint = catalogFingerprint(catalog, this.#registry);
    if (this.#runtime !== undefined && fingerprint === this.#fingerprint) {
      return this.#runtime;
    }
    const config = buildEmbeddedAcmeRuntimeConfig({
      env: this.#env,
      catalog,
      registry: this.#registry,
      ...(this.#nvidiaEndpoint === undefined
        ? {}
        : { nvidiaEndpoint: this.#nvidiaEndpoint }),
    });
    this.#runtime = this.#runtimeFactory({
      config,
      openAiTransport: this.#providerTransport,
      chatCompletionsTransport: this.#providerTransport,
    });
    this.#fingerprint = fingerprint;
    return this.#runtime;
  }

  async complete(
    request: ChatRequest,
    callbacks: ChatCallbacks = {},
  ): Promise<ChatCompletion> {
    const catalog = loadUserCatalog(this.#catalogPath);
    const executionProvider = resolveExecutionProvider(request.model, catalog);
    const requiredKey =
      executionProvider === "openai"
        ? "OPENAI_API_KEY"
        : executionProvider === "kie"
          ? "KIE_API_KEY"
          : "NVIDIA_API_KEY";
    if (requireKey(this.#env, requiredKey) === undefined) {
      throw new ChatError(
        "configuration",
        `${requiredKey} is required for ${executionProvider} chat.`,
      );
    }

    const body = buildAcmeExecuteBody(request, {
      requestKey: this.#requestKey(),
      timeoutMs: this.#timeoutMs,
      catalog,
    });
    const runtime = this.#runtimeFor(catalog);
    let reasoning = "";
    const emitDeltas = request.options?.stream !== false;

    try {
      const result = await runtime.execute(executionRequest(body), {
        ...(request.signal === undefined ? {} : { signal: request.signal }),
        onEvent: (event) => {
          if (event.type === "reasoning-delta") {
            reasoning += event.text;
            if (emitDeltas && event.text.length > 0) {
              callbacks.onDelta?.({ type: "reasoning", text: event.text });
            }
          } else if (
            event.type === "content-delta" &&
            emitDeltas &&
            event.text.length > 0
          ) {
            callbacks.onDelta?.({ type: "content", text: event.text });
          }
        },
      });
      if (result.status !== "succeeded") {
        throw chatErrorFromAcmeFailure(result.error, result, true);
      }
      const completion = completionFromAcmeResponse(result.response, result);
      return reasoning.length === 0 ? completion : { ...completion, reasoning };
    } catch (cause) {
      if (isChatError(cause)) throw cause;
      throw new ChatError(
        "provider",
        cause instanceof Error
          ? cause.message
          : "Embedded ACME model execution failed.",
        { cause },
      );
    }
  }
}

export function createEmbeddedAcmeChatTransport(
  options: EmbeddedAcmeChatTransportOptions,
): ChatTransport {
  return new EmbeddedAcmeChatTransport(options);
}
