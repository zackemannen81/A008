import { ChatSession } from "../core/chat-session.js";
import { ChatError } from "../core/errors.js";
import {
  DEFAULT_MODEL_ID,
  defaultModelRegistry,
  type ModelRegistry,
} from "../core/model-registry.js";
import type { ChatTransport } from "../core/types.js";
import {
  NvidiaChatTransport,
  type NvidiaChatTransportOptions,
} from "../providers/nvidia/nvidia-chat-transport.js";

export { DEFAULT_SYSTEM_MESSAGE } from "../core/chat-invocation.js";
export const NVIDIA_ENDPOINT_ENV = "NVIDIA_CHAT_COMPLETIONS_URL";

export interface NvidiaSessionCompositionOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly model?: string;
  readonly systemMessage?: string;
  readonly registry?: ModelRegistry;
  readonly fetch?: NvidiaChatTransportOptions["fetch"];
  readonly timeoutMs?: NvidiaChatTransportOptions["timeoutMs"];
  readonly createTransport?: (
    options: NvidiaChatTransportOptions,
  ) => ChatTransport;
}

function requireApiKey(env: NodeJS.ProcessEnv): string {
  const apiKey = env.NVIDIA_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    throw new ChatError(
      "configuration",
      "NVIDIA_API_KEY is required for NVIDIA chat.",
    );
  }
  return apiKey;
}

function optionalEndpoint(env: NodeJS.ProcessEnv): string | undefined {
  const endpoint = env[NVIDIA_ENDPOINT_ENV]?.trim();
  return endpoint === undefined || endpoint.length === 0 ? undefined : endpoint;
}

export function createNvidiaTransportOptions(
  options: NvidiaSessionCompositionOptions,
): NvidiaChatTransportOptions {
  const apiKey = requireApiKey(options.env);
  const endpoint = optionalEndpoint(options.env);
  return {
    apiKey,
    ...(endpoint === undefined ? {} : { endpoint }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.timeoutMs === undefined
      ? {}
      : { timeoutMs: options.timeoutMs }),
  };
}

export function createNvidiaChatTransport(
  options: NvidiaSessionCompositionOptions,
): ChatTransport {
  const transportOptions = createNvidiaTransportOptions(options);
  return (
    options.createTransport ?? ((input) => new NvidiaChatTransport(input))
  )(transportOptions);
}

export function createNvidiaChatSession(
  options: NvidiaSessionCompositionOptions,
): ChatSession {
  const registry = options.registry ?? defaultModelRegistry;
  const profile = registry.require(options.model ?? DEFAULT_MODEL_ID);
  const transport = createNvidiaChatTransport(options);

  return new ChatSession({
    model: profile.id,
    transport,
    ...(options.systemMessage === undefined
      ? {}
      : { systemMessage: options.systemMessage }),
    generation: profile.defaults,
  });
}
