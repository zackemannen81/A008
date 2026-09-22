#!/usr/bin/env node

import { Readable, Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import * as acp from "@agentclientprotocol/sdk";
import { createLocalMemoryRuntime } from "../runtime/local-memory-runtime.js";
import { A008AcpAgent, sessionNotifier } from "./A008-acp-agent.js";
import { ModelToolSession } from "../tools/model-tools.js";
import { prepareAcpTools } from "../tools/acp-tools.js";
import { nativeToolCatalog } from "../tools/repository-tools.js";
import {
  catalogBackedModelRegistry,
  defaultCatalogPath,
} from "../core/user-catalog.js";
import { defaultModelRegistry } from "../core/model-registry.js";

export interface AcpServerOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly stdin?: Readable;
  readonly stdout?: Writable;
  readonly stderr?: NodeJS.WritableStream;
}

export function createAcpRuntime(options: {
  env: NodeJS.ProcessEnv;
  cwd?: string;
  stderr: NodeJS.WritableStream;
  ownershipAlreadyHeld?: boolean;
}) {
  const { env, stderr } = options;
  const registry = catalogBackedModelRegistry(
    defaultModelRegistry,
    defaultCatalogPath(env),
  );
  const runtime = createLocalMemoryRuntime({
    env,
    surface: "acp",
    stderr,
    registry,
    ...(options.ownershipAlreadyHeld ? { ownershipAlreadyHeld: true } : {}),
  });
  const agent = new A008AcpAgent({
    sessionControls: true,
    registry,
    extraProfiles: () => [],
    runtimeInfo: () => ({
      cwd: options.cwd ?? process.cwd(),
      projectId: runtime.projectId,
      memoryPath: runtime.sqlitePath,
      tools: nativeToolCatalog(),
    }),
    inspectMemory: (query) => runtime.inspectMemory(query),
    createSession: (model, sessionOptions) =>
      runtime.openSession({
        model,
        ...(sessionOptions?.workspaceConversation === undefined
          ? {}
          : { workspaceConversation: sessionOptions.workspaceConversation }),
      }),
    resolveImageAttachment: (locator) =>
      runtime.resolveImageAttachment(locator),
    // Wired only here, so an agent constructed without a runtime refuses
    // `_a008/source/ingest` instead of silently doing nothing.
    sharedMemoryCapabilities: () => runtime.sharedMemoryCapabilities(),
    recallSharedMemory: async (params) =>
      await runtime.recallSharedMemory(params),
    writeSharedMemory: (params) => runtime.writeSharedMemory(params),
    ingestSource: async (params) => {
      const outcome = await runtime.ingestSource(params);
      return {
        artifactId: outcome.artifactId,
        utteranceIds: [...outcome.utteranceIds],
        contentKind: outcome.contentKind,
        relation: outcome.relation,
        speaker: outcome.speaker,
        ...(outcome.knowledge === undefined
          ? {}
          : { knowledge: { ...outcome.knowledge } }),
      };
    },
    onMemoryDiagnostic: (message) => {
      stderr.write(`memory> ${message}\n`);
    },
  });
  return { runtime, agent };
}

export async function runAcpServer(
  options: AcpServerOptions = {},
): Promise<void> {
  const env = options.env ?? process.env;
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const { runtime, agent } = createAcpRuntime({ env, stderr });
  const tools = new Map<string, ModelToolSession>();
  const active = new Set<Promise<unknown>>();
  const stream = acp.ndJsonStream(
    Writable.toWeb(stdout) as WritableStream<Uint8Array>,
    Readable.toWeb(stdin) as ReadableStream<Uint8Array>,
  );
  try {
    const connection = acp
      .agent({ name: "A008" })
      .onRequest("initialize", (context) => agent.initialize(context.params))
      .onRequest("session/new", (context) => {
        const toolSession = new ModelToolSession({
          cwd: process.cwd(),
          env,
          mcpServers: context.params.mcpServers,
        });
        const created = agent.newSession(context.params);
        tools.set(created.sessionId, toolSession);
        return created;
      })
      .onRequest("session/set_config_option", (context) =>
        agent.setSessionConfigOption(context.params),
      )
      .onRequest("session/prompt", (context) => {
        const work = agent.prompt(
          context.params,
          sessionNotifier(context.client),
          (signal, budgets) =>
            prepareAcpTools(
              tools.get(context.params.sessionId)!,
              context.params.sessionId,
              budgets,
              signal,
              sessionNotifier(context.client),
              (params) =>
                context.client.request("session/request_permission", params),
            ),
        );
        active.add(work);
        void work.finally(() => active.delete(work)).catch(() => undefined);
        return work;
      })
      // The fluent agent builder registers nothing implicitly, so the optional
      // `session/close` method needs its own handler even though the agent
      // advertises the capability from `initialize`.
      .onRequest("session/close", async (context) => {
        const result = agent.closeSession(context.params);
        await tools.get(context.params.sessionId)?.close();
        tools.delete(context.params.sessionId);
        return result;
      })
      .onRequest(
        "_a008/session/control",
        (params: unknown) => params,
        async (context) => {
          const result = agent.controlSession(context.params);
          for (const [id, tool] of tools) {
            if (!agent.openSessionIds().includes(id)) {
              tools.delete(id);
              await tool.close();
            }
          }
          return result;
        },
      )
      // ADR 0020 D4. Registered through the custom-method overload, which takes
      // an explicit params parser; the agent re-validates regardless.
      .onRequest(
        "memory/capabilities",
        (params: unknown) => params,
        async (context) => await agent.sharedMemoryCapabilities(context.params),
      )
      .onRequest(
        "memory/recall",
        (params: unknown) => params,
        async (context) => await agent.recallMemory(context.params),
      )
      .onRequest(
        "memory/write",
        (params: unknown) => params,
        async (context) => await agent.writeMemory(context.params),
      )
      .onRequest(
        "_a008/source/ingest",
        (params: unknown) => params,
        async (context) => await agent.ingestSource(context.params),
      )
      .onRequest(
        "memory/inspect",
        (params: unknown) => params,
        async (context) => await agent.inspectMemory(context.params),
      )
      .onNotification("session/cancel", (context) =>
        agent.cancel(context.params),
      )
      .connect(stream);

    await connection.closed;
  } finally {
    for (const id of agent.openSessionIds()) agent.cancel({ sessionId: id });
    await Promise.allSettled([...active]);
    await Promise.allSettled([...tools.values()].map((tool) => tool.close()));
    runtime.close();
  }
}

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(entryPath).href
) {
  runAcpServer().catch((error: unknown) => {
    const stderr = process.stderr;
    stderr.write(
      `A008-acp failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  });
}
