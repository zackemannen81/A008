import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ProjectWorkspaceStore } from "../src/runtime/project-workspace-store.js";
import { isolatedMemoryEnv } from "./helpers.js";

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

test("project workspace store creates isolated worktree, reports status and discards clean ownership", () => {
  const fixture = isolatedMemoryEnv();
  const root = join(fixture.directory, "project");
  mkdirSync(root);
  git(root, ["init"]);
  git(root, ["config", "user.email", "a008@example.test"]);
  git(root, ["config", "user.name", "A008 Test"]);
  execFileSync("git", ["commit", "--allow-empty", "-m", "initial"], {
    cwd: root,
    stdio: "ignore",
  });
  const store = new ProjectWorkspaceStore(
    join(fixture.directory, "workspaces.sqlite"),
  );
  try {
    const shared = store.createShared("project", root);
    assert.equal(shared.workspaceMode, "shared");
    const session = store.createWorktree({ projectId: "project", root });
    assert.equal(session.workspaceMode, "worktree");
    assert.match(session.branchName!, /^a008\/session-/u);
    assert.equal(store.status(session.id).clean, true);
    assert.equal(store.discard(session.id).disposition, "discarded");
  } finally {
    store.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
