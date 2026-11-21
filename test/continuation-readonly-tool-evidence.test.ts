import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  continuationArtifactPaths,
  inspectContinuationWorkspace,
  isReadOnlyGitInvocation,
} from "../src/platform/continuation-workspace.js";
import type { RunToolInteraction } from "../src/core/chat-continuation.js";
import { SELECT_TOOLS } from "../src/core/runtime-tool-context.js";
import { WORKFLOW_PROGRESS_TOOL } from "../src/core/task-workflow.js";

const actualReadonlyGitCommands = [
  ["status", "--short"],
  ["log", "-5", "--oneline", "--decorate"],
  ["rev-parse", "--show-toplevel", "HEAD"],
  ["ls-tree", "-r", "--name-only", "HEAD"],
  ["show", "--stat", "--oneline", "HEAD"],
  ["show", "--stat", "--oneline", "f9b72fa"],
  ["diff", "--stat", "f9b72fa..HEAD"],
  ["branch", "--show-current"],
];
const round = (
  id: string,
  calls: readonly { name: string; arguments: string }[],
): RunToolInteraction => ({
  id,
  messages: [
    {
      role: "assistant",
      content: "",
      toolCalls: calls.map((call, index) => ({
        id: `call_${id}_${index}`,
        ...call,
      })),
    },
    ...calls.map((call, index) => ({
      role: "tool" as const,
      toolCallId: `call_${id}_${index}`,
      content: JSON.stringify({
        status: "completed",
        outcome: "command_success",
      }),
    })),
  ],
});

test("the actual status/log/revision/tree/show/diff Git reads from the incident are verifiable", () => {
  for (const args of actualReadonlyGitCommands)
    assert.equal(
      isReadOnlyGitInvocation(JSON.stringify({ args, max_output_bytes: 4000 })),
      true,
      args.join(" "),
    );
  const interactions = [
    round("r:1", [
      {
        name: SELECT_TOOLS,
        arguments: JSON.stringify({ names: ["git", "read_file"] }),
      },
    ]),
    round(
      "r:2",
      actualReadonlyGitCommands.map((args) => ({
        name: "git",
        arguments: JSON.stringify({ args, max_output_bytes: 4000 }),
      })),
    ),
    round("r:3", [
      { name: "read_file", arguments: '{"path":"docs/GDD.md"}' },
      { name: "list_files", arguments: '{"path":"docs"}' },
    ]),
    round("r:4", [
      {
        name: WORKFLOW_PROGRESS_TOOL,
        arguments: '{"completed":[],"nextAction":"Next"}',
      },
    ]),
  ];
  const evidence = continuationArtifactPaths(interactions);
  assert.equal(evidence.verifiable, true);
  assert.deepEqual(evidence.paths, ["docs", "docs/GDD.md"]);
});

test("mutating Git commands, unsupported options and opaque tool calls still fail closed", () => {
  for (const args of [
    ["commit", "-am", "message"],
    ["checkout", "main"],
    ["reset", "--hard"],
    ["push"],
    ["config", "user.email", "foo"],
    ["show", "--output=copy.txt", "HEAD"],
    ["diff", "--output", "copy.txt"],
    ["log", "--exec=touch.txt"],
    ["branch", "-D", "main"],
    ["-c", "alias.status=!echo bad", "status"],
  ])
    assert.equal(
      isReadOnlyGitInvocation(JSON.stringify({ args })),
      false,
      args.join(" "),
    );
  assert.equal(isReadOnlyGitInvocation("{not-json"), false);
  assert.equal(isReadOnlyGitInvocation('{"args":"status"}'), false);
  assert.equal(
    continuationArtifactPaths([
      round("r:1", [
        { name: "git", arguments: '{"args":["checkout","HEAD~1"]}' },
      ]),
    ]).verifiable,
    false,
  );
  assert.equal(
    continuationArtifactPaths([
      round("r:1", [
        { name: "exec_command", arguments: '{"command":"echo hi"}' },
      ]),
    ]).verifiable,
    false,
  );
});

test("read-only Git and internal workflow progress generate a verifiable, tamper-sensitive fingerprint", () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-checkpoint-readonly-"));
  try {
    const git = (args: string[]) =>
      execFileSync("git", args, {
        cwd,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
    git(["init", "-q"]);
    writeFileSync(join(cwd, "GDD.md"), "Draft v1");
    git(["add", "GDD.md"]);
    git([
      "-c",
      "user.email=fixture@example.com",
      "-c",
      "user.name=A008 Fixture",
      "commit",
      "-qm",
      "initial",
    ]);
    const interactions = [
      round("r:1", [
        {
          name: "git",
          arguments: JSON.stringify({ args: ["status", "--short"] }),
        },
        {
          name: WORKFLOW_PROGRESS_TOOL,
          arguments: '{"completed":[],"nextAction":"Review draft"}',
        },
      ]),
    ];
    const artifacts = continuationArtifactPaths(interactions);
    const before = inspectContinuationWorkspace(cwd, artifacts);
    assert.equal(before.verifiable, true, before.reason);
    assert.ok(before.digest);
    writeFileSync(join(cwd, "GDD.md"), "Draft v2");
    const after = inspectContinuationWorkspace(cwd, artifacts);
    assert.equal(after.verifiable, true, after.reason);
    assert.notEqual(after.digest, before.digest);
    const opaque = inspectContinuationWorkspace(
      cwd,
      continuationArtifactPaths([
        round("r:2", [
          { name: "git", arguments: '{"args":["reset","--hard"]}' },
        ]),
      ]),
    );
    assert.equal(opaque.verifiable, false);
    assert.equal(opaque.reason, "opaque-tool-or-unverifiable-prior");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
