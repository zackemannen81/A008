import { once } from "node:events";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { pathToFileURL } from "node:url";

export const FAKE_NVIDIA_REPLY_TOKEN = "A008-CANVAS-LOOPBACK-OK";
export const FAKE_NVIDIA_REASONING = "Verified by the local A008 fixture.";

export interface FakeNvidiaRequestEvidence {
  readonly authorizationAccepted: boolean;
  readonly messageCount: number;
  readonly method: string | undefined;
  readonly model: string | undefined;
  readonly path: string | undefined;
  readonly userMessage: string | undefined;
}

export interface FakeNvidiaServerOptions {
  readonly expectedApiKey: string;
  readonly host?: string;
  readonly onRequest?: (evidence: FakeNvidiaRequestEvidence) => void;
  readonly port?: number;
  readonly replyToken?: string;
  readonly analyze?: (input: unknown) => unknown;
  readonly classify?: (input: unknown) => unknown;
}

export interface RunningFakeNvidiaServer {
  readonly endpoint: string;
  readonly port: number;
  close(): Promise<void>;
}

interface ChatPayload {
  readonly messages?: Array<{
    readonly content?: unknown;
    readonly role?: unknown;
  }>;
  readonly model?: unknown;
  readonly stream?: unknown;
}

async function readBody(request: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
    if (body.length > 1_048_576) {
      throw new Error("Request body exceeded the 1 MiB fixture limit.");
    }
  }
  return body;
}

function asPayload(value: unknown): ChatPayload {
  return typeof value === "object" && value !== null
    ? (value as ChatPayload)
    : {};
}

function lastUserMessage(payload: ChatPayload): string | undefined {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }
  return undefined;
}

function semanticEnvelope(
  payload: ChatPayload,
): { readonly operation: string; readonly input: unknown } | undefined {
  const content = lastUserMessage(payload);
  if (content === undefined) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return undefined;
    }
    const raw = parsed as {
      readonly operation?: unknown;
      readonly input?: unknown;
    };
    if (typeof raw.operation === "string") {
      return { operation: raw.operation, input: raw.input };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function writeJson(
  response: import("node:http").ServerResponse,
  content: unknown,
): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify(content),
          },
          finish_reason: "stop",
        },
      ],
    }),
  );
}

function writeSse(
  response: import("node:http").ServerResponse,
  token: string,
): void {
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": "text/event-stream",
  });
  response.write(
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: FAKE_NVIDIA_REASONING } }] })}\n\n`,
  );
  response.write(
    `data: ${JSON.stringify({ choices: [{ delta: { content: token }, finish_reason: "stop" }] })}\n\n`,
  );
  response.end("data: [DONE]\n\n");
}

export async function startFakeNvidiaServer(
  options: FakeNvidiaServerOptions,
): Promise<RunningFakeNvidiaServer> {
  const host = options.host ?? "127.0.0.1";
  const server: Server = createServer(async (request, response) => {
    try {
      if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
      }

      const authorizationAccepted =
        request.headers.authorization === `Bearer ${options.expectedApiKey}`;
      if (!authorizationAccepted) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "fixture authorization failed" }));
        return;
      }

      const payload = asPayload(JSON.parse(await readBody(request)));
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      options.onRequest?.({
        authorizationAccepted,
        messageCount: messages.length,
        method: request.method,
        model: typeof payload.model === "string" ? payload.model : undefined,
        path: request.url,
        userMessage: lastUserMessage(payload),
      });
      const streaming = payload.stream !== false;
      const envelope = semanticEnvelope(payload);
      if (!streaming || envelope !== undefined) {
        if (envelope?.operation === "retrieval_scope") {
          writeJson(response, { domains: [], relatedDomains: [] });
          return;
        }
        if (envelope?.operation === "knowledge_analysis") {
          writeJson(response, options.analyze?.(envelope.input) ?? []);
          return;
        }
        if (envelope?.operation === "relation_classification") {
          writeJson(
            response,
            options.classify?.(envelope.input) ?? { type: "new" },
          );
          return;
        }
        writeJson(response, []);
        return;
      }
      writeSse(response, options.replyToken ?? FAKE_NVIDIA_REPLY_TOKEN);
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "invalid request",
        }),
      );
    }
  });

  server.listen(options.port ?? 0, host);
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Fake NVIDIA server did not bind a TCP port.");
  }

  return {
    endpoint: `http://${host}:${address.port}/v1/chat/completions`,
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) =>
          error === undefined ? resolve() : reject(error),
        );
      }),
  };
}

async function main(): Promise<void> {
  const expectedApiKey = process.env.A008_FAKE_NVIDIA_API_KEY?.trim();
  if (!expectedApiKey) {
    throw new Error("A008_FAKE_NVIDIA_API_KEY is required.");
  }
  const portText = process.env.A008_FAKE_NVIDIA_PORT ?? "18999";
  const port = Number.parseInt(portText, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`A008_FAKE_NVIDIA_PORT is invalid: ${portText}`);
  }

  const running = await startFakeNvidiaServer({
    expectedApiKey,
    port,
    onRequest: (evidence) => {
      process.stdout.write(
        `${JSON.stringify({ event: "request_received", ...evidence })}\n`,
      );
    },
  });
  process.stdout.write(
    `${JSON.stringify({ event: "listening", endpoint: running.endpoint })}\n`,
  );

  const stop = async (): Promise<void> => {
    await running.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
