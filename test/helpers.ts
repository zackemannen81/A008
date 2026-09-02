import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import type { ChatRequest, ChatTransport } from "../src/core/types.js";

export const TEST_PROJECT_ID =
  "a007_v1_project_40000000-0000-4000-8000-000000000016";
export const TEST_AGENT_ID =
  "a007_v1_agent_40000000-0000-4000-8000-000000000017";

export function isolatedMemoryEnv(
  overrides: NodeJS.ProcessEnv = {},
): {
  readonly directory: string;
  readonly sqlitePath: string;
  readonly env: NodeJS.ProcessEnv;
} {
  const directory = mkdtempSync(join(tmpdir(), "a007-memory-"));
  const sqlitePath = join(directory, "memory.sqlite");
  return {
    directory,
    sqlitePath,
    env: {
      NVIDIA_API_KEY: "test-token",
      A007_PROJECT_ID: TEST_PROJECT_ID,
      A007_AGENT_ID: TEST_AGENT_ID,
      A007_MEMORY_SQLITE_PATH: sqlitePath,
      A007_DEBUG_TRACE: "off",
      ...overrides,
    },
  };
}

export function semanticOperation(
  request: ChatRequest,
): "knowledge_analysis" | "relation_classification" | undefined {
  const content = request.messages.at(-1)?.content;
  if (content === undefined) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    const operation = (parsed as { readonly operation?: unknown }).operation;
    if (
      operation === "knowledge_analysis" ||
      operation === "relation_classification"
    ) {
      return operation;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function semanticInput(request: ChatRequest): unknown {
  const content = request.messages.at(-1)?.content;
  if (content === undefined) {
    return undefined;
  }
  const parsed = JSON.parse(content) as { readonly input?: unknown };
  return parsed.input;
}

export function memoryAwareFakeTransport(options: {
  readonly chat: (
    request: ChatRequest,
    chatTurn: number,
  ) => { readonly content: string; readonly reasoning?: string };
  readonly analyze?: (input: unknown) => unknown;
  readonly classify?: (input: unknown) => unknown;
}): ChatTransport & { readonly requests: ChatRequest[] } {
  const requests: ChatRequest[] = [];
  let chatTurn = 0;
  const transport: ChatTransport & { readonly requests: ChatRequest[] } = {
    requests,
    async complete(request, callbacks) {
      requests.push(request);
      const operation = semanticOperation(request);
      if (operation === "knowledge_analysis") {
        const content = JSON.stringify(
          options.analyze?.(semanticInput(request)) ?? [],
        );
        return { message: { role: "assistant", content } };
      }
      if (operation === "relation_classification") {
        const content = JSON.stringify(
          options.classify?.(semanticInput(request)) ?? { type: "new" },
        );
        return { message: { role: "assistant", content } };
      }
      chatTurn += 1;
      const result = options.chat(request, chatTurn);
      if (result.reasoning !== undefined) {
        callbacks?.onDelta?.({ type: "reasoning", text: result.reasoning });
      }
      callbacks?.onDelta?.({ type: "content", text: result.content });
      return {
        message: { role: "assistant", content: result.content },
        ...(result.reasoning === undefined ? {} : { reasoning: result.reasoning }),
      };
    },
  };
  return transport;
}

export function uniqueTraceFile(directory: string): string {
  return join(directory, `${randomUUID()}.debug.jsonl`);
}

export function byteStream(
  chunks: readonly (string | Uint8Array)[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === "string" ? encoder.encode(chunk) : chunk,
        );
      }
      controller.close();
    },
  });
}

export function splitBytes(value: string, widths: readonly number[]): Uint8Array[] {
  const bytes = new TextEncoder().encode(value);
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let index = 0;

  while (offset < bytes.length) {
    const width = widths[index % widths.length] ?? 1;
    chunks.push(bytes.slice(offset, offset + width));
    offset += width;
    index += 1;
  }

  return chunks;
}

export function captureStream(): {
  readonly stream: Writable;
  readonly text: () => string;
} {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { stream, text: () => chunks.join("") };
}
