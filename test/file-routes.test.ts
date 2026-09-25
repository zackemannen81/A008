import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { listWorkspaceFiles, readWorkspaceTextFile, writeWorkspaceTextFile } from "../src/gui-host/file-routes.js";

test("workspace file routes contain browsing and guard text writes", () => {
  const root = mkdtempSync(join(tmpdir(), "A008-files-"));
  mkdirSync(join(root, "nested"));
  writeFileSync(join(root, "note.ts"), "const value = 1;\n", "utf8");
  writeFileSync(join(root, "nested", "readme.md"), "# nested\n", "utf8");
  mkdirSync(join(root, ".git"));
  const listed = listWorkspaceFiles(root, ".");
  assert.deepEqual(listed.map((entry) => entry.path), ["./nested", "./note.ts"]);
  const opened = readWorkspaceTextFile(root, "./note.ts");
  assert.equal(opened.content, "const value = 1;\n");
  const saved = writeWorkspaceTextFile(root, "./note.ts", opened.sha256, "const value = 2;\n");
  assert.equal(saved.content, "const value = 2;\n");
  assert.throws(() => writeWorkspaceTextFile(root, "./note.ts", opened.sha256, "stale\n"), /changed since it was opened/u);
  assert.throws(() => readWorkspaceTextFile(root, "../escape.txt"), /stay inside/u);
  assert.throws(() => listWorkspaceFiles(root, ".git"), /\.git access/u);
});

test("workspace file routes refuse symlinks and binary text", () => {
  const root = mkdtempSync(join(tmpdir(), "A008-files-"));
  const outside = join(tmpdir(), "A008-outside.txt");
  writeFileSync(outside, "outside", "utf8");
  try {
    symlinkSync(outside, join(root, "outside-link.txt"));
    assert.throws(() => readWorkspaceTextFile(root, "outside-link.txt"), /symbolic links/u);
  } catch (reason) {
    assert.equal((reason as NodeJS.ErrnoException).code, "EPERM");
  }
  writeFileSync(join(root, "binary.dat"), Buffer.from([0, 1, 2]));
  assert.throws(() => readWorkspaceTextFile(root, "binary.dat"), /not UTF-8/u);
});
