#!/usr/bin/env node

import { Readable, Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import * as acp from "@agentclientprotocol/sdk";
import { A008AcpAgent, sessionNotifier } from "../../src/acp/A008-acp-agent.js";
import { ChatSession } from "../../src/core/chat-session.js";
import { ChatError } from "../../src/core/errors.js";
import type { ChatTransport } from "../../src/core/types.js";

const transport: ChatTransport = {
  async complete(request, callbacks) {
    const last = request.messages.at(-1)?.content ?? "";
    if (last === "fail") {
      throw new ChatError("provider", "synthetic ACP failure");
    }
    callbacks?.onDelta?.({ type: "reasoning", text: "thinking" });
    if (last === "wait") {
      await new Promise<void>((_resolve, reject) => {
        const abort = (): void => {
          reject(new ChatError("cancelled", "cancelled"));
        };
        if (request.signal?.aborted) {
          abort();
          return;
        }
        request.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    callbacks?.onDelta?.({ type: "content", text: "hello" });
    return {
      message: { role: "assistant", content: "hello" },
      reasoning: "thinking",
    };
  },
};

/**
 * Params for the ADR 0020 D4 extension method this fake registers, so
 * `acp-bridge.ts`'s `ingestSource` can be exercised over a real stdio ACP
 * connection even though the real sibling agent handler (A008-0043) does not
 * exist on this branch.
 */
interface FakeSourceIngestParams {
  readonly locator: string;
  readonly mediaType: string;
  readonly filename?: string;
}

async function main(): Promise<void> {
  const agent = new A008AcpAgent({
    createSession: (model) => new ChatSession({ model, transport }),
  });
  const stream = acp.ndJsonStream(
    Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
    Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
  );
  const connection = acp
    .agent({ name: "A008" })
    .onRequest("initialize", (context) => agent.initialize(context.params))
    .onRequest("session/new", (context) => agent.newSession(context.params))
    .onRequest("session/set_config_option", (context) =>
      agent.setSessionConfigOption(context.params),
    )
    .onRequest("session/prompt", (context) =>
      agent.prompt(context.params, sessionNotifier(context.client)),
    )
    .onNotification("session/cancel", (context) => agent.cancel(context.params))
    .onRequest(
      "_a008/source/ingest",
      (params) => params as FakeSourceIngestParams,
      (context) => {
        if (context.params.mediaType === "application/x-fake-unsupported") {
          throw new Error(
            `unsupported media type: ${context.params.mediaType}`,
          );
        }
        return {
          artifactId: `artifact-${context.params.filename ?? "unnamed"}`,
          utteranceIds: ["utt-1"],
          contentKind: "document",
          relation: "appears_in",
          speaker: "fake-uploader",
        };
      },
    )
    .connect(stream);
  await connection.closed;
}

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(entryPath).href
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `fake ACP failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  });
}
