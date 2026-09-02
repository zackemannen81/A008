import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import test from "node:test";
import {
  PROTOCOL_VERSION,
  type NewSessionRequest,
} from "@agentclientprotocol/sdk";
import { A007AcpAgent } from "../src/acp/a007-acp-agent.js";
import { createLocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import {
  isolatedMemoryEnv,
  memoryAwareFakeTransport,
  semanticOperation,
} from "./helpers.js";

const NEW_SESSION: NewSessionRequest = {
  cwd: "C:\\workspace",
  mcpServers: [],
};
const SESSION_ID =
  "a007_v1_acp_session_00000000-0000-4000-8000-000000000001";
const ASSERTION =
  "Durable fact: the local memory project code is alpha-seven.";
const PROPOSITION = "the local memory project code is alpha-seven";

test("ACP agent streams thought/answer then settles memory without protocol diagnostics", async () => {
  const isolated = isolatedMemoryEnv();
  const transport = memoryAwareFakeTransport({
    chat: (_request, chatTurn) => ({
      content: chatTurn === 1 ? "Noted." : "alpha-seven",
      reasoning: "ACP_PRIVATE",
    }),
    analyze: (input) => {
      const raw = input as { readonly message?: unknown };
      return raw.message === ASSERTION
        ? [
            {
              proposition: PROPOSITION,
              kind: "fact",
              tags: ["memory"],
              domains: ["runtime"],
              entities: ["alpha-seven"],
            },
          ]
        : [];
    },
    classify: () => ({ type: "new" }),
  });
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "acp",
    createTransport: () => transport,
  });
  const diagnostics: string[] = [];
  const agent = new A007AcpAgent({
    createSession: (model) => runtime.openSession({ model }),
    createSessionId: () => SESSION_ID,
    onMemoryDiagnostic: (message) => diagnostics.push(message),
  });
  const notifications: unknown[] = [];

  try {
    agent.initialize({ protocolVersion: PROTOCOL_VERSION });
    agent.newSession(NEW_SESSION);
    const first = await agent.prompt(
      {
        sessionId: SESSION_ID,
        prompt: [{ type: "text", text: ASSERTION }],
      },
      async (notification) => {
        notifications.push(notification.update);
      },
    );
    const second = await agent.prompt(
      {
        sessionId: SESSION_ID,
        prompt: [
          { type: "text", text: "What is the local memory project code?" },
        ],
      },
      async (notification) => {
        notifications.push(notification.update);
      },
    );

    assert.equal(first.stopReason, "end_turn");
    assert.equal(second.stopReason, "end_turn");
    assert.deepEqual(diagnostics, []);
    assert.match(JSON.stringify(notifications), /Noted/u);
    assert.match(JSON.stringify(notifications), /alpha-seven/u);
    assert.match(JSON.stringify(notifications), /ACP_PRIVATE/u);
    const chatRequests = transport.requests.filter(
      (request) => semanticOperation(request) === undefined,
    );
    assert.match(chatRequests[1]?.messages.at(-1)?.content ?? "", new RegExp(PROPOSITION, "u"));
    assert.equal(
      JSON.stringify(chatRequests[1]?.messages).includes("ACP_PRIVATE"),
      false,
    );
  } finally {
    runtime.close();
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});
