#!/usr/bin/env node

import { Readable, Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import * as acp from "@agentclientprotocol/sdk";
import { createLocalMemoryRuntime } from "../runtime/local-memory-runtime.js";
import { A008AcpAgent, sessionNotifier } from "./A008-acp-agent.js";

export interface AcpServerOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly stdin?: Readable;
  readonly stdout?: Writable;
  readonly stderr?: NodeJS.WritableStream;
}

export async function runAcpServer(options: AcpServerOptions = {}): Promise<void> {
  const env = options.env ?? process.env;
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const runtime = createLocalMemoryRuntime({
    env,
    surface: "acp",
    stderr,
  });
  const agent = new A008AcpAgent({
    createSession: (model) => runtime.openSession({ model }),
    onMemoryDiagnostic: (message) => {
      stderr.write(`memory> ${message}\n`);
    },
  });
  const stream = acp.ndJsonStream(
    Writable.toWeb(stdout) as WritableStream<Uint8Array>,
    Readable.toWeb(stdin) as ReadableStream<Uint8Array>,
  );
  try {
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
      .connect(stream);

    await connection.closed;
  } finally {
    runtime.close();
  }
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  runAcpServer().catch((error: unknown) => {
    const stderr = process.stderr;
    stderr.write(
      `A008-acp failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  });
}
