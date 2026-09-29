import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { RunToolInteraction } from "../core/chat-continuation.js";

export interface ContinuationWorkspaceEvidence {
  readonly paths: readonly string[];
  readonly verifiable: boolean;
  readonly revision: string | null;
  readonly digest: string | null;
}

/** Inspectable local tools identify their artifacts; opaque effects fail closed. */
export function continuationArtifactPaths(
  interactions: readonly RunToolInteraction[],
  prior?: ContinuationWorkspaceEvidence,
): { paths: string[]; verifiable: boolean } {
  const paths = new Set(prior?.paths ?? []);
  let verifiable = prior?.verifiable ?? true;
  for (const interaction of interactions) {
    for (const message of interaction.messages) {
      if (message.role !== "assistant" || !("toolCalls" in message)) continue;
      for (const call of message.toolCalls) {
        try {
          if (
            !["read_file", "list_files", "create_file", "edit_file"].includes(
              call.name,
            )
          )
            throw new Error("Opaque artifact evidence");
          const args = JSON.parse(call.arguments) as { path?: unknown };
          if (typeof args.path !== "string")
            throw new Error("Missing artifact path");
          paths.add(args.path);
        } catch {
          verifiable = false;
        }
      }
    }
  }
  return { paths: [...paths].sort(), verifiable };
}

/** Bounded, read-only fingerprint. Unsupported/missing evidence never means unchanged. */
export function inspectContinuationWorkspace(
  cwd: string,
  artifacts: {
    readonly paths: readonly string[];
    readonly verifiable: boolean;
  },
): ContinuationWorkspaceEvidence {
  const unavailable = {
    ...artifacts,
    verifiable: false,
    revision: null,
    digest: null,
  };
  if (!artifacts.verifiable) return unavailable;
  try {
    const root = realpathSync(cwd);
    const git = (args: string[]) =>
      execFileSync("git", args, {
        cwd,
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 8 * 1024 * 1024,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    // A deleted worktree must not accidentally resolve its parent repository.
    if (realpathSync(git(["rev-parse", "--show-toplevel"]).trim()) !== root)
      return unavailable;
    const revision = git(["rev-parse", "HEAD"]).trim();
    const files = new Set(
      git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
        .split("\0")
        .filter(Boolean),
    );
    for (const path of artifacts.paths) files.add(path);
    if (files.size > 10_000) return unavailable;
    const index = git(["ls-files", "--stage", "-z"]);
    if (index.split("\0").some((entry) => entry.startsWith("160000 ")))
      return unavailable;
    const hash = createHash("sha256").update(
      JSON.stringify([
        revision,
        git(["rev-parse", "--abbrev-ref", "HEAD"]).trim(),
        index,
      ]),
    );
    let bytes = 0;
    for (const path of [...files].sort()) {
      const absolute = resolve(root, path);
      const rel = relative(root, absolute);
      if (
        isAbsolute(rel) ||
        rel === ".." ||
        rel.startsWith(`..${sep}`) ||
        rel.split(sep).includes(".git")
      )
        return unavailable;
      hash.update(JSON.stringify(rel));
      let stat;
      try {
        stat = lstatSync(absolute);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          hash.update("missing");
          continue;
        }
        throw error;
      }
      const canonical = realpathSync(absolute);
      const canonicalRel = relative(root, canonical);
      if (
        stat.isSymbolicLink() ||
        canonicalRel === ".." ||
        canonicalRel.startsWith(`..${sep}`) ||
        isAbsolute(canonicalRel)
      )
        return unavailable;
      if (stat.isDirectory()) {
        // list_files observes the directory entries, not recursive ignored contents.
        const entries = readdirSync(absolute, { withFileTypes: true })
          .map((entry) => [
            entry.name,
            entry.isDirectory(),
            entry.isSymbolicLink(),
          ])
          .sort();
        hash.update(JSON.stringify(entries));
      } else if (stat.isFile()) {
        bytes += stat.size;
        if (bytes > 64 * 1024 * 1024) return unavailable;
        hash.update(
          JSON.stringify([
            stat.mode,
            createHash("sha256").update(readFileSync(absolute)).digest("hex"),
          ]),
        );
      } else return unavailable;
    }
    return { ...artifacts, revision, digest: hash.digest("hex") };
  } catch {
    return unavailable;
  }
}
