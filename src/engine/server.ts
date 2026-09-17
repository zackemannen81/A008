#!/usr/bin/env node
import { Readable, Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import * as acp from "@agentclientprotocol/sdk";
import { parseSessionControl } from "../core/session-control.js";
import { sessionNotifier } from "../acp/A008-acp-agent.js";
import { EngineHost } from "./engine-host.js";

export async function runEngineServer(
  options: {
    env?: NodeJS.ProcessEnv;
    stdin?: Readable;
    stdout?: Writable;
    stderr?: NodeJS.WritableStream;
  } = {},
) {
  const engine = new EngineHost({
    env: options.env ?? process.env,
    stderr: options.stderr ?? process.stderr,
  });
  const stream = acp.ndJsonStream(
    Writable.toWeb(
      options.stdout ?? process.stdout,
    ) as WritableStream<Uint8Array>,
    Readable.toWeb(
      options.stdin ?? process.stdin,
    ) as ReadableStream<Uint8Array>,
  );
  const identity = (value: unknown) => value;
  const sessionId = (value: unknown): string => {
    if (
      value &&
      typeof value === "object" &&
      "sessionId" in value &&
      typeof value.sessionId === "string"
    )
      return value.sessionId;
    throw new Error("Engine operation requires sessionId.");
  };
  try {
    const connection = acp
      .agent({ name: "A008" })
      .onRequest("initialize", (c) => engine.initialize(c.params))
      .onRequest("session/new", (c) =>
        engine.newSession(c.params, {
          requestPermission: (params) =>
            c.client.request("session/request_permission", params),
          notify: sessionNotifier(c.client),
        }),
      )
      .onRequest("session/prompt", (c) =>
        engine.prompt(c.params, sessionNotifier(c.client)),
      )
      .onRequest("session/set_config_option", (c) =>
        engine.setConfigOption(c.params),
      )
      .onRequest("session/close", (c) =>
        engine.closeSession(c.params.sessionId),
      )
      .onRequest("_a008/session/control", identity, (c) =>
        engine.control(sessionId(c.params), parseSessionControl(c.params)),
      )
      .onRequest("memory/capabilities", identity, (c) =>
        engine.sharedMemoryCapabilities(c.params),
      )
      .onRequest("memory/recall", identity, (c) =>
        engine.projectAgent(c.params).recallMemory(c.params),
      )
      .onRequest("memory/write", identity, (c) =>
        engine.projectAgent(c.params).writeMemory(c.params),
      )
      .onRequest("memory/inspect", identity, (c) =>
        engine.projectAgent(c.params).inspectMemory(c.params),
      )
      .onRequest("_a008/source/ingest", identity, (c) =>
        engine.projectAgent(c.params).ingestSource(c.params),
      )
      .onNotification("session/cancel", (c) =>
        engine.sessionAgent(c.params.sessionId).cancel(c.params),
      )
      .connect(stream);
    await connection.closed;
  } finally {
    await engine.close();
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  runEngineServer().catch((error) => {
    process.stderr.write(
      `A008 engine failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  });
}
