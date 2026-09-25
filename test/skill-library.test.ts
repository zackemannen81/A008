import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillPrompt } from "../gui/src/composer/submit.js";
import { discoverSkills, importSkill, installedSkills, removeInstalledSkill } from "../src/gui-host/skill-library.js";

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
}

test("skill discovery accepts only bounded SKILL.md paths", async () => {
  const skills = await discoverSkills(async () => response({ tree: [
    { type: "blob", path: "skills/pdfs/SKILL.md" },
    { type: "blob", path: "skills/pdfs/run.sh" },
    { type: "tree", path: "skills/ignored/SKILL.md" },
  ] }) as Response);
  assert.deepEqual(skills.map((skill) => skill.id), ["pdfs"]);
});

test("selected skill instructions are scoped to the submitted prompt", () => {
  assert.equal(skillPrompt("Review this", undefined), "Review this");
  assert.equal(skillPrompt("Review this", {
    id: "pdfs",
    name: "PDFs",
    description: "Work with PDFs",
    instructions: "Use PDF instructions.",
    sourcePath: "skills/pdfs/SKILL.md",
  }), "Review this\n\n[Selected skill: PDFs]\nUse PDF instructions.");
});

test("skill import persists instructions and explicit remove deletes them", async () => {
  const root = mkdtempSync(join(tmpdir(), "a008-skills-"));
  const catalogPath = join(root, "catalog.json");
  try {
    const skill = await importSkill({
      catalogPath,
      sourcePath: "skills/pdfs/SKILL.md",
      fetch: async () => response("---\ndescription: Work with PDFs\n---\n# PDFs\nUse these instructions.") as Response,
    });
    assert.equal(skill.id, "pdfs");
    assert.equal(installedSkills(catalogPath).length, 1);
    removeInstalledSkill(catalogPath, "pdfs");
    assert.deepEqual(installedSkills(catalogPath), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
