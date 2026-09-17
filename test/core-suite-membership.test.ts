import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Guards the hand-maintained `test:core` list against the one thing it is bad
 * at: silence.
 *
 * A008-0040 found `evidence.test.ts` and `state-history.test.ts` missing from
 * the list. Twenty cases had never run. Nothing was broken — both passed the
 * moment they were executed — which is precisely the problem: the suite
 * reported a smaller number and no one had a reason to look.
 *
 * `docs/backlog/discovery-based-core-suite.md` weighed three fixes. This is its
 * option 3, and it was chosen over globbing `dist/test/**` because `npm run
 * build` does not clean `dist/`: a glob there would keep running compiled
 * JavaScript whose TypeScript source had been deleted, which is a worse failure
 * than the one being fixed. Naming the files keeps `test:core` a command a
 * person can read and a stale artifact unreachable; this test supplies the only
 * thing the list was missing.
 *
 * It is invoked twice on purpose. It is a member of `test:core` like any other
 * file, and `npm test` also runs it by name through `test:membership`. Deleting
 * its own entry from the list would otherwise disable the check that would have
 * caught the deletion.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEST_ROOT = join(REPO_ROOT, "test");
const DIST_PREFIX = "dist/test/";

interface PackageManifest {
  readonly scripts?: Readonly<Record<string, string>>;
}

function readCoreScript(): string {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
  ) as PackageManifest;
  const script = manifest.scripts?.["test:core"];
  assert.ok(typeof script === "string", "package.json has no test:core script");
  return script;
}

function listedEntries(script: string): readonly string[] {
  return script
    .split(/\s+/)
    .filter((token) => token.startsWith(DIST_PREFIX))
    .map((token) => token.slice(DIST_PREFIX.length));
}

async function sourceTestFiles(directory: string): Promise<readonly string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await sourceTestFiles(full)));
      continue;
    }
    if (entry.name.endsWith(".test.ts")) {
      found.push(relative(TEST_ROOT, full).replace(/\\/g, "/"));
    }
  }
  return found;
}

/** `test/knowledge-model/evidence.test.ts` -> `knowledge-model/evidence.test.js` */
function compiledName(source: string): string {
  return source.replace(/\.ts$/, ".js");
}

test("every core test file is named by test:core", async () => {
  const listed = new Set(listedEntries(readCoreScript()));
  const sources = await sourceTestFiles(TEST_ROOT);

  assert.ok(sources.length > 0, "no test sources were found at all");

  const missing = sources
    .filter((source) => !listed.has(compiledName(source)))
    .map((source) => `test/${source}`);

  assert.deepEqual(
    missing,
    [],
    `these test files exist but test:core never runs them:\n  ${missing.join("\n  ")}\n` +
      `Add ${DIST_PREFIX}<name>.js to the test:core script in package.json.`,
  );
});

test("test:core names nothing that no longer has a source", async () => {
  // The reverse direction. A renamed file leaves an entry pointing at a path
  // `tsc` no longer produces; `node --test` would fail on it, but with a module
  // resolution error rather than the reason.
  const listed = listedEntries(readCoreScript());
  const sources = new Set((await sourceTestFiles(TEST_ROOT)).map(compiledName));

  const orphaned = listed
    .filter((entry) => !sources.has(entry))
    .map((entry) => `${DIST_PREFIX}${entry}`);

  assert.deepEqual(
    orphaned,
    [],
    `test:core names files with no TypeScript source:\n  ${orphaned.join("\n  ")}`,
  );
});

test("test:core names no file twice", () => {
  const listed = listedEntries(readCoreScript());
  const seen = new Set<string>();
  const duplicated = listed.filter((entry) => {
    if (seen.has(entry)) {
      return true;
    }
    seen.add(entry);
    return false;
  });
  assert.deepEqual(
    duplicated,
    [],
    `duplicated in test:core: ${duplicated.join(", ")}`,
  );
});

test("this check is itself in the list, and runs under its own script name", () => {
  // Both halves matter. Membership is what makes it run with the suite; the
  // named script is what keeps it running if the membership entry is removed,
  // which is exactly the edit it exists to catch.
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
  ) as PackageManifest;
  const self = "core-suite-membership.test.js";

  assert.ok(
    listedEntries(readCoreScript()).includes(self),
    "test:core does not name core-suite-membership.test.js",
  );

  const membership = manifest.scripts?.["test:membership"];
  assert.ok(
    typeof membership === "string" && membership.includes(self),
    "no test:membership script runs this file by name",
  );
  assert.ok(
    manifest.scripts?.["test"]?.includes("test:membership") === true,
    "npm test does not run test:membership",
  );
});
