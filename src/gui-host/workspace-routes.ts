import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
import { ProjectWorkspaceError, ProjectWorkspaceStore, type ProjectWorkspaceSession, type WorkspaceGitStatus } from "../runtime/project-workspace-store.js";

export interface WorkspaceSessionView extends ProjectWorkspaceSession {
  readonly status: WorkspaceGitStatus;
}

export class GuiWorkspaceStore {
  readonly #database: Database.Database;
  readonly #sessions: ProjectWorkspaceStore;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.#database = new Database(path);
    this.#database.exec("CREATE TABLE IF NOT EXISTS A008_gui_workspace_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    this.#sessions = new ProjectWorkspaceStore(path);
  }

  workspaceRoot(): string | undefined {
    return (this.#database.prepare("SELECT value FROM A008_gui_workspace_settings WHERE key = 'workspaceRoot'").get() as { value?: string } | undefined)?.value;
  }

  setWorkspaceRoot(path: string): string {
    const value = path.trim();
    if (!isAbsolute(value)) throw new ProjectWorkspaceError("Workspace root must be an absolute directory.");
    const root = resolve(value);
    this.#database.prepare("INSERT INTO A008_gui_workspace_settings (key, value) VALUES ('workspaceRoot', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(root);
    return root;
  }

  list(projectId: string): readonly WorkspaceSessionView[] {
    return this.#sessions.list(projectId).map((session) => ({ ...session, status: session.disposition === "discarded" ? { modifiedFiles: 0, commitsAhead: 0, clean: true } : this.#sessions.status(session.id) }));
  }

  create(projectId: string, root: string, baseBranch?: string): WorkspaceSessionView {
    const workspaceRoot = this.workspaceRoot();
    const session = this.#sessions.createWorktree({
      projectId,
      root,
      ...(baseBranch === undefined ? {} : { baseBranch }),
      ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
    });
    return { ...session, status: this.#sessions.status(session.id) };
  }

  keep(id: string): WorkspaceSessionView {
    const session = this.#sessions.keep(id);
    return { ...session, status: this.#sessions.status(session.id) };
  }

  discard(id: string): WorkspaceSessionView {
    const session = this.#sessions.discard(id);
    return { ...session, status: { modifiedFiles: 0, commitsAhead: 0, clean: true } };
  }

  close(): void {
    this.#sessions.close();
    this.#database.close();
  }
}
