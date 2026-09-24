import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";

export type WorkspaceMode = "shared" | "worktree";
export type WorkspaceDisposition = "active" | "kept" | "discarded";

export interface ProjectWorkspaceSession {
  readonly id: string;
  readonly projectId: string;
  readonly workspaceMode: WorkspaceMode;
  readonly workspacePath: string;
  readonly branchName?: string;
  readonly baseBranch?: string;
  readonly disposition: WorkspaceDisposition;
  readonly createdAt: string;
}

export interface WorkspaceGitStatus {
  readonly modifiedFiles: number;
  readonly commitsAhead: number;
  readonly clean: boolean;
}

export class ProjectWorkspaceError extends Error {}

export class ProjectWorkspaceStore {
  readonly #database: BetterSqliteDatabase;

  constructor(path: string) {
    this.#database = new Database(path);
    this.#database.pragma("busy_timeout = 5000");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS A008_project_workspace_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        workspace_mode TEXT NOT NULL CHECK (workspace_mode IN ('shared', 'worktree')),
        workspace_path TEXT NOT NULL,
        branch_name TEXT,
        base_branch TEXT,
        disposition TEXT NOT NULL CHECK (disposition IN ('active', 'kept', 'discarded')),
        created_at TEXT NOT NULL
      );
    `);
  }

  createShared(projectId: string, root: string): ProjectWorkspaceSession {
    return this.#insert({
      id: `workspace_${randomUUID()}`,
      projectId,
      workspaceMode: "shared",
      workspacePath: root,
      disposition: "active",
      createdAt: new Date().toISOString(),
    });
  }

  createWorktree(input: {
    projectId: string;
    root: string;
    baseBranch?: string;
  }): ProjectWorkspaceSession {
    const root = canonicalDirectory(input.root);
    ensureGitRepository(root);
    const baseBranch =
      input.baseBranch?.trim() || git(root, ["branch", "--show-current"]);
    if (!baseBranch)
      throw new ProjectWorkspaceError(
        "The repository has no current base branch.",
      );
    const id = `workspace_${randomUUID()}`;
    const branchName = `a008/session-${id.slice(-8)}`;
    const workspacePath = join(
      dirname(root),
      `${basename(root)}-workspaces`,
      id.slice(-8),
    );
    mkdirSync(dirname(workspacePath), { recursive: true });
    git(root, ["worktree", "add", workspacePath, "-b", branchName, baseBranch]);
    try {
      return this.#insert({
        id,
        projectId: input.projectId,
        workspaceMode: "worktree",
        workspacePath,
        branchName,
        baseBranch,
        disposition: "active",
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      try {
        git(root, ["worktree", "remove", "--force", workspacePath]);
      } catch {}
      throw error;
    }
  }

  get(id: string): ProjectWorkspaceSession {
    const row = this.#database
      .prepare("SELECT * FROM A008_project_workspace_sessions WHERE id = ?")
      .get(id) as Row | undefined;
    if (!row)
      throw new ProjectWorkspaceError("Unknown project workspace session.");
    return fromRow(row);
  }

  list(projectId: string): readonly ProjectWorkspaceSession[] {
    return (
      this.#database
        .prepare(
          "SELECT * FROM A008_project_workspace_sessions WHERE project_id = ? ORDER BY created_at DESC",
        )
        .all(projectId) as Row[]
    ).map(fromRow);
  }

  status(id: string): WorkspaceGitStatus {
    const session = this.get(id);
    if (session.workspaceMode === "shared")
      return gitStatus(session.workspacePath, undefined);
    return gitStatus(session.workspacePath, session.baseBranch);
  }

  keep(id: string): ProjectWorkspaceSession {
    const session = this.get(id);
    if (session.workspaceMode !== "worktree")
      throw new ProjectWorkspaceError("Only worktree sessions can be kept.");
    this.#database
      .prepare(
        "UPDATE A008_project_workspace_sessions SET disposition = 'kept' WHERE id = ?",
      )
      .run(id);
    return this.get(id);
  }

  discard(id: string): ProjectWorkspaceSession {
    const session = this.get(id);
    if (session.workspaceMode !== "worktree")
      throw new ProjectWorkspaceError("Shared workspaces cannot be discarded.");
    if (session.disposition === "discarded") return session;
    const status = this.status(id);
    if (!status.clean)
      throw new ProjectWorkspaceError(
        "Workspace has modified files. Keep it or commit/discard changes explicitly before removal.",
      );
    const root = git(session.workspacePath, [
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    const repository = resolve(root, "..");
    git(repository, ["worktree", "remove", session.workspacePath]);
    if (existsSync(session.workspacePath))
      rmSync(session.workspacePath, { recursive: true, force: true });
    this.#database
      .prepare(
        "UPDATE A008_project_workspace_sessions SET disposition = 'discarded' WHERE id = ?",
      )
      .run(id);
    return this.get(id);
  }

  close(): void {
    this.#database.close();
  }

  #insert(session: ProjectWorkspaceSession): ProjectWorkspaceSession {
    this.#database
      .prepare(
        `INSERT INTO A008_project_workspace_sessions (id, project_id, workspace_mode, workspace_path, branch_name, base_branch, disposition, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.projectId,
        session.workspaceMode,
        session.workspacePath,
        session.branchName ?? null,
        session.baseBranch ?? null,
        session.disposition,
        session.createdAt,
      );
    return session;
  }
}

interface Row {
  id: string;
  project_id: string;
  workspace_mode: WorkspaceMode;
  workspace_path: string;
  branch_name: string | null;
  base_branch: string | null;
  disposition: WorkspaceDisposition;
  created_at: string;
}
function fromRow(row: Row): ProjectWorkspaceSession {
  return {
    id: row.id,
    projectId: row.project_id,
    workspaceMode: row.workspace_mode,
    workspacePath: row.workspace_path,
    ...(row.branch_name ? { branchName: row.branch_name } : {}),
    ...(row.base_branch ? { baseBranch: row.base_branch } : {}),
    disposition: row.disposition,
    createdAt: row.created_at,
  };
}
function canonicalDirectory(path: string): string {
  if (!isAbsolute(path) || !existsSync(path))
    throw new ProjectWorkspaceError(
      "Project root must be an existing absolute directory.",
    );
  return realpathSync(path);
}
function ensureGitRepository(cwd: string): void {
  if (git(cwd, ["rev-parse", "--is-inside-work-tree"]) !== "true")
    throw new ProjectWorkspaceError(
      "Parallel sessions require a Git repository.",
    );
}
function git(cwd: string, args: readonly string[]): string {
  const result = spawnSync("git", ["--no-pager", ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new ProjectWorkspaceError(
      (result.stderr || result.stdout || "Git operation failed.").trim(),
    );
  return result.stdout.trim();
}
function gitStatus(
  cwd: string,
  baseBranch: string | undefined,
): WorkspaceGitStatus {
  ensureGitRepository(cwd);
  const porcelain = git(cwd, ["status", "--porcelain=v1"]);
  const modifiedFiles = porcelain ? porcelain.split("\n").length : 0;
  const commitsAhead = baseBranch
    ? Number.parseInt(
        git(cwd, ["rev-list", "--count", `${baseBranch}..HEAD`]) || "0",
        10,
      )
    : 0;
  return { modifiedFiles, commitsAhead, clean: modifiedFiles === 0 };
}
