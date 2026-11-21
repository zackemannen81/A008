import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { RunToolInteraction } from "../core/chat-continuation.js";
import { SELECT_TOOLS } from "../core/runtime-tool-context.js";
import { WORKFLOW_PROGRESS_TOOL } from "../core/task-workflow.js";

export interface ContinuationWorkspaceEvidence {
  readonly paths: readonly string[];
  readonly verifiable: boolean;
  readonly revision: string | null;
  readonly digest: string | null;
  /** Fixed, non-sensitive reason for an unverifiable observation. */
  readonly reason?: string;
}

/** A deliberately narrow allowlist. Git's read-only porcelain must not be
 * treated as an opaque effect, while Git writes and unknown options fail closed.
 * This is only recovery classification; it never grants tool permissions.
 */
export function isReadOnlyGitInvocation(argumentsJson: string): boolean {
  let data: unknown;
  try {
    data = JSON.parse(argumentsJson);
  } catch {
    return false;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const args = (data as { args?: unknown }).args;
  if (
    !Array.isArray(args) ||
    args.length === 0 ||
    args.length > 40 ||
    args.some(
      (arg) =>
        typeof arg !== "string" ||
        arg.length === 0 ||
        arg.length > 320 ||
        /[\r\n\0]/.test(arg),
    )
  )
    return false;
  const [command, ...rest] = args as string[];
  if (command === "branch")
    return rest.length === 1 && rest[0] === "--show-current";
  const allowed = new Map<string, ReadonlySet<string>>([
    [
      "status",
      new Set([
        "--short",
        "-s",
        "--porcelain",
        "--porcelain=v1",
        "--porcelain=v2",
        "--branch",
        "-sb",
        "--untracked-files=all",
        "--untracked-files=normal",
        "--ignored",
      ]),
    ],
    [
      "log",
      new Set([
        "--oneline",
        "--decorate",
        "--stat",
        "--name-only",
        "--no-patch",
        "--all",
        "--first-parent",
        "--reverse",
      ]),
    ],
    [
      "rev-parse",
      new Set([
        "--show-toplevel",
        "--abbrev-ref",
        "--verify",
        "--short",
        "--show-prefix",
        "--show-cdup",
        "--is-inside-work-tree",
        "--git-dir",
        "--show-superproject-working-tree",
      ]),
    ],
    ["ls-tree", new Set(["-r", "-z", "--name-only", "--long", "-d", "-t"])],
    [
      "ls-files",
      new Set([
        "--cached",
        "--others",
        "--exclude-standard",
        "--stage",
        "--name-only",
        "-z",
        "--full-name",
        "--deduplicate",
      ]),
    ],
    [
      "show",
      new Set([
        "--stat",
        "--oneline",
        "--name-only",
        "--no-patch",
        "--format=oneline",
      ]),
    ],
    [
      "diff",
      new Set([
        "--stat",
        "--name-only",
        "--check",
        "--cached",
        "--no-ext-diff",
        "--no-textconv",
        "--summary",
        "--numstat",
        "--shortstat",
      ]),
    ],
  ]);
  const options = command ? allowed.get(command) : undefined;
  if (!options) return false;
  const ref = /^[A-Za-z0-9][A-Za-z0-9._\/~^:-]{0,220}$/;
  let paths = false;
  for (const arg of rest) {
    if (arg === "--") {
      paths = true;
      continue;
    }
    if (paths) {
      // Relative paths are observations; reject traversal and option-like forms.
      if (
        arg.startsWith("-") ||
        arg.startsWith("/") ||
        arg.includes("..") ||
        arg.includes("\\") ||
        arg.includes(":")
      )
        return false;
    } else if (arg.startsWith("-")) {
      if (!options.has(arg) && !(command === "log" && /^-\d{1,4}$/.test(arg)))
        return false;
    } else if (!ref.test(arg)) {
      return false;
    }
  }
  // A command with zero arguments may be legitimate; no executable subcommand
  // except the explicitly recognized read-only one can reach this branch.
  return true;
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
        // Internal metadata and evidence-bound checklist updates have no
        // filesystem/external effect; their state is already in recovery JSON.
        if (call.name === SELECT_TOOLS || call.name === WORKFLOW_PROGRESS_TOOL)
          continue;
        if (call.name === "git" && isReadOnlyGitInvocation(call.arguments))
          continue;
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
  const unavailable = (reason: string): ContinuationWorkspaceEvidence => ({
    ...artifacts,
    verifiable: false,
    revision: null,
    digest: null,
    reason,
  });
  if (!artifacts.verifiable)
    return unavailable("opaque-tool-or-unverifiable-prior");
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
      return unavailable("workspace-git-root-mismatch");
    const revision = git(["rev-parse", "HEAD"]).trim();
    const files = new Set(
      git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
        .split("\0")
        .filter(Boolean),
    );
    for (const path of artifacts.paths) files.add(path);
    if (files.size > 10_000) return unavailable("workspace-file-count-limit");
    const index = git(["ls-files", "--stage", "-z"]);
    if (index.split("\0").some((entry) => entry.startsWith("160000 ")))
      return unavailable("workspace-git-submodule");
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
        return unavailable("invalid-or-outside-artifact-path");
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
        return unavailable("artifact-symlink-or-outside-repository");
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
        if (bytes > 64 * 1024 * 1024)
          return unavailable("workspace-byte-limit");
        hash.update(
          JSON.stringify([
            stat.mode,
            createHash("sha256").update(readFileSync(absolute)).digest("hex"),
          ]),
        );
      } else return unavailable("unsupported-artifact-type");
    }
    return { ...artifacts, revision, digest: hash.digest("hex") };
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "";
    return unavailable(`inspection-error:${name}${code ? `/${code}` : ""}`);
  }
}
