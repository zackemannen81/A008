import assert from "node:assert/strict";
import test from "node:test";
import {
  v2CommandReceiptSchema,
  v2SessionCommandSchema,
  type V2SessionCommand,
} from "../packages/protocol/src/index.js";
import {
  V2CommandReceiptStore,
  canonicalCommandDigest,
} from "../src/gui-host/v2-command-receipts.js";
import { V2AuthError } from "../src/gui-host/v2-auth.js";
import { TEST_PROJECT_ID } from "./helpers.js";

function command(commandId: string, text = "hello"): V2SessionCommand {
  return v2SessionCommandSchema.parse({
    type: "command",
    requestId: `request_${commandId}`,
    commandId,
    action: "session/prompt",
    projectId: TEST_PROJECT_ID,
    sessionId: "session_receipt",
    payload: { text },
  });
}

const hasCode = (expected: string) => (error: unknown) =>
  error instanceof V2AuthError && error.code === expected;

test("A008-0138 protocol requires commandId only for mutations", () => {
  assert.equal(
    v2SessionCommandSchema.safeParse({
      type: "command",
      requestId: "r1",
      action: "session/inspect",
      projectId: TEST_PROJECT_ID,
      sessionId: "session_a",
    }).success,
    true,
  );
  assert.equal(
    v2SessionCommandSchema.safeParse({
      type: "command",
      requestId: "r2",
      action: "session/control",
      projectId: TEST_PROJECT_ID,
      sessionId: "session_a",
      payload: { control: { action: "inspect" } },
    }).success,
    true,
  );
  assert.equal(
    v2SessionCommandSchema.safeParse({
      type: "command",
      requestId: "r3",
      action: "session/prompt",
      projectId: TEST_PROJECT_ID,
      sessionId: "session_a",
      payload: { text: "missing command identity" },
    }).success,
    false,
  );
  assert.equal(
    v2SessionCommandSchema.safeParse({
      type: "command",
      requestId: "r4",
      action: "session/control",
      projectId: TEST_PROJECT_ID,
      sessionId: "session_a",
      payload: { control: { action: "reset" } },
    }).success,
    false,
  );
});

test("A008-0138 canonical digest ignores request attempt identity and key order", () => {
  const first = command("stable_command", "same");
  const second = v2SessionCommandSchema.parse({
    type: "command",
    requestId: "another_attempt",
    commandId: "stable_command",
    action: "session/prompt",
    projectId: TEST_PROJECT_ID,
    sessionId: "session_receipt",
    payload: { text: "same" },
  });
  assert.equal(canonicalCommandDigest(first), canonicalCommandDigest(second));
  assert.notEqual(
    canonicalCommandDigest(first),
    canonicalCommandDigest(command("stable_command", "changed")),
  );
});

test("A008-0138 receipt store deduplicates, conflicts and expires terminal receipts", () => {
  let now = 1_000;
  const store = new V2CommandReceiptStore({
    serverInstanceId: "server_receipts",
    now: () => now,
    retentionMs: 300_000,
  });
  const first = command("stable_command");
  const begun = store.begin("principal_a", first);
  assert.equal(begun.kind, "new");
  assert.equal(begun.receipt.status, "running");
  assert.equal(JSON.stringify(begun.receipt).includes("hello"), false);

  const duplicate = store.begin("principal_a", {
    ...first,
    requestId: "retry_request",
  });
  assert.equal(duplicate.kind, "existing");
  assert.equal(duplicate.receipt.status, "running");

  assert.throws(
    () => store.begin("principal_a", command("stable_command", "different")),
    hasCode("COMMAND_CONFLICT"),
  );

  const settled = store.succeed("principal_a", "stable_command", {
    sessionId: "session_receipt",
    turnId: "turn_receipt",
  });
  assert.equal(settled.status, "succeeded");
  assert.equal(
    v2CommandReceiptSchema.safeParse(
      store.lookup("principal_a", TEST_PROJECT_ID, "stable_command"),
    ).success,
    true,
  );

  now += 299_999;
  assert.equal(
    store.lookup("principal_a", TEST_PROJECT_ID, "stable_command").status,
    "succeeded",
  );
  now += 1;
  assert.throws(
    () => store.lookup("principal_a", TEST_PROJECT_ID, "stable_command"),
    hasCode("COMMAND_UNKNOWN"),
  );
});

test("A008-0138 capacity never evicts running or unexpired receipts", () => {
  let now = 10_000;
  const store = new V2CommandReceiptStore({
    serverInstanceId: "server_capacity",
    now: () => now,
    retentionMs: 300_000,
    limitPerPrincipal: 1,
  });
  store.begin("principal_a", command("running_one"));
  now += 1_000_000;
  assert.throws(
    () => store.begin("principal_a", command("blocked_two")),
    hasCode("CAPACITY_EXCEEDED"),
  );

  store.succeed("principal_a", "running_one");
  assert.throws(
    () => store.begin("principal_a", command("still_blocked")),
    hasCode("CAPACITY_EXCEEDED"),
  );
  now += 300_000;
  assert.equal(store.begin("principal_a", command("after_expiry")).kind, "new");
});

test("A008-0138 receipt identity is principal-scoped and project lookup is opaque", () => {
  const store = new V2CommandReceiptStore({
    serverInstanceId: "server_scope",
  });
  store.begin("principal_a", command("same_id"));
  store.begin("principal_b", command("same_id"));
  assert.equal(
    store.lookup("principal_a", TEST_PROJECT_ID, "same_id").commandId,
    "same_id",
  );
  assert.throws(
    () =>
      store.lookup(
        "principal_a",
        "A008_v1_project_40000000-0000-4000-8000-000000000099",
        "same_id",
      ),
    hasCode("COMMAND_UNKNOWN"),
  );
});
