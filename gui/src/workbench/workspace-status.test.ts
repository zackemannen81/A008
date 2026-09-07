import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseGitLsFiles,
  parseGitShortstat,
  parseGitStatusShort,
} from "./workspace-status.js";

test("parses git status -sb branch, upstream, ahead and dirty files", () => {
  const parsed = parseGitStatusShort(
    "## main...origin/main [ahead 2]\n M gui/src/app.tsx\n?? .grok/\n",
  );
  assert.equal(parsed.isRepo, true);
  assert.equal(parsed.branch, "main");
  assert.equal(parsed.upstream, "origin/main");
  assert.equal(parsed.ahead, 2);
  assert.equal(parsed.behind, 0);
  assert.equal(parsed.changedFiles, 2);
});

test("parses behind and detached headers without inventing a repository", () => {
  const behind = parseGitStatusShort("## topic...origin/topic [behind 4]\n");
  assert.equal(behind.behind, 4);
  assert.equal(behind.changedFiles, 0);
  const empty = parseGitStatusShort("fatal: not a git repository");
  assert.equal(empty.isRepo, false);
  assert.equal(empty.branch, "");
});

test("parses shortstat insertions and deletions", () => {
  assert.deepEqual(
    parseGitShortstat(" 3 files changed, 10 insertions(+), 2 deletions(-)\n"),
    { added: 10, removed: 2 },
  );
  assert.deepEqual(parseGitShortstat(""), { added: 0, removed: 0 });
});

test("parses git ls-files and ignores blank lines", () => {
  assert.deepEqual(parseGitLsFiles("gui/src/app.tsx\n\nAGENTS.md\n"), [
    { path: "gui/src/app.tsx" },
    { path: "AGENTS.md" },
  ]);
});
