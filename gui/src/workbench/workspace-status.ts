import { executeShellCommand } from "../terminal/run-shell-command.js";

export interface WorkspaceStatus {
  readonly isRepo: boolean;
  readonly branch: string;
  readonly upstream: string | undefined;
  readonly ahead: number;
  readonly behind: number;
  readonly added: number;
  readonly removed: number;
  readonly changedFiles: number;
}

export interface WorkspaceFile {
  readonly path: string;
}

const EMPTY_STATUS: WorkspaceStatus = {
  isRepo: false,
  branch: "",
  upstream: undefined,
  ahead: 0,
  behind: 0,
  added: 0,
  removed: 0,
  changedFiles: 0,
};

export function parseGitStatusShort(stdout: string): {
  readonly branch: string;
  readonly upstream: string | undefined;
  readonly ahead: number;
  readonly behind: number;
  readonly changedFiles: number;
  readonly isRepo: boolean;
} {
  const lines = stdout
    .replace(/\r\n/gu, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const header = lines.find((line) => line.startsWith("## "));
  if (header === undefined) {
    return {
      branch: "",
      upstream: undefined,
      ahead: 0,
      behind: 0,
      changedFiles: 0,
      isRepo: false,
    };
  }
  const body = header.slice(3).trim();
  const ahead = Number(/\[ahead (\d+)/u.exec(body)?.[1] ?? 0);
  const behind = Number(/\[behind (\d+)/u.exec(body)?.[1] ?? 0);
  const names = body.replace(/\s*\[.*$/u, "");
  const [branchPart, upstreamPart] = names.split("...");
  let branch = (branchPart ?? "").trim();
  if (
    branch === "HEAD (no branch)" ||
    branch.startsWith("No commits yet on ")
  ) {
    branch = branch.replace(/^No commits yet on /u, "") || "HEAD";
  }
  const changedFiles = lines.filter((line) => !line.startsWith("## ")).length;
  return {
    branch,
    upstream: upstreamPart?.trim() || undefined,
    ahead,
    behind,
    changedFiles,
    isRepo: true,
  };
}

export function parseGitShortstat(stdout: string): {
  readonly added: number;
  readonly removed: number;
} {
  const added = Number(/(\d+) insertions?/u.exec(stdout)?.[1] ?? 0);
  const removed = Number(/(\d+) deletions?/u.exec(stdout)?.[1] ?? 0);
  return { added, removed };
}

export function parseGitLsFiles(stdout: string): readonly WorkspaceFile[] {
  return stdout
    .replace(/\r\n/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("exit:"))
    .map((path) => ({ path }));
}

function output(stdout: string, stderr: string): string {
  return `${stdout}\n${stderr}`;
}

export async function loadWorkspaceStatus(
  fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceStatus> {
  try {
    const status = await executeShellCommand("git status -sb", {
      fetch: fetchImpl,
    });
    const combined = output(status.stdout, status.stderr);
    if (status.exitCode !== 0 || /not a git repository/iu.test(combined)) {
      return EMPTY_STATUS;
    }
    const parsed = parseGitStatusShort(status.stdout);
    if (!parsed.isRepo) {
      return EMPTY_STATUS;
    }
    const [unstaged, staged] = await Promise.all([
      executeShellCommand("git diff --shortstat", { fetch: fetchImpl }),
      executeShellCommand("git diff --cached --shortstat", {
        fetch: fetchImpl,
      }),
    ]);
    const unstagedStat = parseGitShortstat(unstaged.stdout);
    const stagedStat = parseGitShortstat(staged.stdout);
    return {
      ...parsed,
      added: unstagedStat.added + stagedStat.added,
      removed: unstagedStat.removed + stagedStat.removed,
    };
  } catch {
    return EMPTY_STATUS;
  }
}

export async function loadWorkspaceFiles(
  fetchImpl: typeof fetch = fetch,
): Promise<readonly WorkspaceFile[]> {
  try {
    const result = await executeShellCommand("git ls-files", {
      fetch: fetchImpl,
    });
    if (result.exitCode !== 0) {
      return [];
    }
    return parseGitLsFiles(result.stdout);
  } catch {
    return [];
  }
}
