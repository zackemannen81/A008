import assert from "node:assert/strict";
import test from "node:test";
import type { GuiSession } from "../session/types.js";
import { runHealth } from "./run-activity.js";

function session(overrides: Record<string, unknown> = {}): GuiSession {
  return {
    busy: true,
    tools: [],
    process: {
      sessionId: "s",
      workspaceId: "w",
      instanceId: "i",
      processId: 123,
      state: "running",
    },
    run: {
      id: "r",
      status: "running",
      model: "gpt-6-luna",
      createdAt: 1_000,
      updatedAt: 1_000,
      leaseGeneration: 2,
      lastProgressAt: 1_000,
    },
    ...overrides,
  } as unknown as GuiSession;
}

test("run health distinguishes stalled work from alive progress", () => {
  const stalled = runHealth(session(), 200_000);
  assert.equal(stalled.state, "STALLED");
  assert.equal(stalled.stalled, true);

  const active = runHealth(
    session({
      run: {
        id: "r",
        status: "running",
        model: "gpt-6-luna",
        createdAt: 1_000,
        updatedAt: 190_000,
        leaseGeneration: 3,
        lastProgressAt: 190_000,
      },
      tools: [{ id: "t", status: "in_progress", title: "exec_command" }],
    }),
    200_000,
  );
  assert.equal(active.state, "RUNNING_TOOL");
  assert.equal(active.stalled, false);
});

test("run health surfaces approval and dead-process states without inventing heartbeats", () => {
  const approval = runHealth(
    session({
      permission: { id: "p", title: "edit_file", text: "approve?" },
      run: {
        id: "r",
        status: "running",
        model: "gpt-6-luna",
        createdAt: 1_000,
        updatedAt: 2_000,
        leaseGeneration: 1,
        lastProgressAt: 2_000,
      },
    }),
    3_000,
  );
  assert.equal(approval.state, "WAITING_APPROVAL");

  const dead = runHealth(
    session({
      process: {
        sessionId: "s",
        workspaceId: "w",
        instanceId: "i",
        processId: 123,
        state: "stopped",
      },
    }),
    3_000,
  );
  assert.equal(dead.state, "PROCESS_DEAD");
});
