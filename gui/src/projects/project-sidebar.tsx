import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  changeProjectChat,
  createWorkspaceSession,
  discardWorkspaceSession,
  keepWorkspaceSession,
  listSidebarProjects,
  loadWorkspaceSessions,
  loadWorkspaceSettings,
  openWorkspaceSession,
  saveWorkspaceSettings,
  updateProject,
} from "../../../packages/client/src/index.js";
import type {
  ProjectSidebar as SidebarData,
  ProjectChatAction,
  WorkspaceSession,
} from "../../../packages/protocol/src/index.js";
import type { GuiSession } from "../session/types.js";
import { guiHttp } from "../client.js";
import { openProject } from "./bootstrap-client.js";
import "./project-sidebar.css";

type Project = SidebarData["projects"][number];
type IconName =
  "folder" | "chat" | "edit" | "pin" | "settings" | "plus" | "more";
export function ProjectIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    folder:
      "M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7h18",
    chat: "M21 11a9 9 0 0 1-13 8l-5 2 2-5A9 9 0 1 1 21 11Z",
    edit: "m14 4 6 6M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5ZM12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
    pin: "m15 3 6 6-5 1-3 5-4-4 5-3 1-5ZM9 15l-6 6",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z",
    plus: "M12 5v14M5 12h14",
    more: "M4 12h.01M12 12h.01M20 12h.01",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function ProjectList(props: {
  data: SidebarData;
  busy: boolean;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onOpen: (project: Project, conversationId?: string) => void;
  onNew: (project: Project) => void;
  onMenu: (project: Project, trigger: HTMLElement) => void;
}) {
  const projects = [...props.data.projects].sort(
    (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  return (
    <ul className="a008-project-tree">
      {projects.map((project) => {
        const active = project.projectId === props.data.currentId;
        const expanded = !props.collapsed.has(project.projectId);
        return (
          <li key={project.projectId}>
            <div
              className={`a008-project-row${active ? " is-active" : ""}`}
              onContextMenu={(event) => {
                event.preventDefault();
                props.onMenu(
                  project,
                  event.currentTarget.querySelector<HTMLButtonElement>(
                    ".a008-project-more",
                  )!,
                );
              }}
            >
              <button
                className="a008-project-folder"
                aria-label={`${expanded ? "Collapse" : "Expand"} ${project.name}`}
                aria-expanded={expanded}
                aria-controls={`chats-${project.projectId}`}
                onClick={() => props.onToggle(project.projectId)}
              >
                <ProjectIcon name="folder" />
                <span className="a008-project-chevron" aria-hidden="true">
                  {expanded ? "⌄" : "›"}
                </span>
              </button>
              <button
                className="a008-project-name"
                title={project.rootFolder}
                disabled={props.busy}
                onClick={() => props.onOpen(project)}
              >
                {project.name}
              </button>
              {project.pinned ? (
                <span className="a008-project-pin" title="Pinned">
                  <ProjectIcon name="pin" />
                </span>
              ) : null}
              <button
                className="a008-project-more a008-project-action"
                aria-label={`Project details: ${project.name}`}
                aria-haspopup="dialog"
                onClick={(event) => props.onMenu(project, event.currentTarget)}
              >
                <ProjectIcon name="more" />
              </button>
              <button
                className="a008-project-action"
                aria-label={`New chat in ${project.name}`}
                title="New chat"
                disabled={props.busy}
                onClick={() => props.onNew(project)}
              >
                <ProjectIcon name="edit" />
              </button>
            </div>
            <ul
              id={`chats-${project.projectId}`}
              className="a008-project-chats"
              hidden={!expanded}
            >
              {project.conversations.length === 0 ? (
                <li className="a008-project-empty">No chats</li>
              ) : (
                project.conversations.map((chat) => (
                  <li key={chat.conversationId}>
                    <button
                      disabled={props.busy}
                      aria-current={active && chat.current ? "page" : undefined}
                      title={chat.title}
                      onClick={() => props.onOpen(project, chat.conversationId)}
                    >
                      {chat.title}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function WorkspaceSessions({ project, onOpened }: { project: Project; onOpened: () => Promise<void> }) {
  const [sessions, setSessions] = useState<readonly WorkspaceSession[]>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const [listed, settings] = await Promise.all([
      loadWorkspaceSessions(guiHttp(), project.projectId),
      loadWorkspaceSettings(guiHttp()),
    ]);
    setSessions(listed.sessions);
    setWorkspaceRoot(settings.workspaceRoot ?? "");
  }, [project.projectId]);
  useEffect(() => { void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load parallel sessions.")); }, [refresh]);
  async function run(action: () => Promise<unknown>, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true); setError("");
    try { await action(); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Workspace action failed."); }
    finally { setBusy(false); }
  }
  return <section className="a008-workspace-sessions" aria-label="Parallel sessions">
    <h2>Parallel sessions</h2>
    <label>Worktree root<input value={workspaceRoot} placeholder="Absolute folder (optional)" onChange={(event) => setWorkspaceRoot(event.target.value)} /></label>
    <button disabled={busy || !workspaceRoot.trim()} onClick={() => void run(() => saveWorkspaceSettings(guiHttp(), workspaceRoot.trim()))}>Save worktree root</button>
    <button disabled={busy} onClick={() => void run(() => createWorkspaceSession(guiHttp(), project.projectId), "Create an isolated worktree session?")}>Create isolated session</button>
    {sessions.length === 0 ? <p>No isolated sessions.</p> : <ul>{sessions.map((session) => <li key={session.id}>
      <strong>{session.branchName ?? "shared"}</strong><br />
      <span>{session.baseBranch ?? "?"} ? {session.status.modifiedFiles} changed ? {session.status.commitsAhead} ahead</span><br />
      <code>{session.workspacePath}</code><br />
      <span>{session.disposition}</span>
      {session.disposition === "active" ? <><button disabled={busy} onClick={() => void run(async () => { await openWorkspaceSession(guiHttp(), project.projectId, session.id); await onOpened(); }, "Open this worktree for the next chat/tool session?")}>Open</button><button disabled={busy} onClick={() => void run(() => keepWorkspaceSession(guiHttp(), project.projectId, session.id), "Keep this worktree and branch?")}>Keep</button><button disabled={busy} onClick={() => void run(() => discardWorkspaceSession(guiHttp(), project.projectId, session.id), "Discard this clean worktree? This cannot be undone.")}>Discard</button><button disabled title="Merge is not available in this task.">Merge</button><button disabled title="Create PR is not available in this task.">Create PR</button></> : null}
    </li>)}</ul>}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}

function ProjectDetails(props: {
  project: Project;
  trigger: HTMLElement;
  onClose: () => void;
  onSave: (values: { name?: string; pinned?: boolean }) => Promise<void>;
  onWorkspaceOpened: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(props.project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const position = () => {
      const anchor = props.trigger.getBoundingClientRect();
      element.style.left = `${Math.max(12, Math.min(anchor.right + 10, window.innerWidth - element.offsetWidth - 12))}px`;
      element.style.top = `${Math.max(12, Math.min(anchor.top - 8, window.innerHeight - element.offsetHeight - 12))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(element);
    window.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      element.close();
      props.trigger.focus();
    };
  }, [props.trigger]);
  async function save(values: { name?: string; pinned?: boolean }) {
    setBusy(true);
    setError("");
    try {
      await props.onSave(values);
      props.onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save project.",
      );
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="a008-project-popover"
      aria-label={`Project details: ${props.project.name}`}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            props.onClose();
        }
      }}
    >
      <header>
        <ProjectIcon name="folder" />
        <strong>{props.project.name}</strong>
        <button
          aria-label={props.project.pinned ? "Unpin project" : "Pin project"}
          aria-pressed={Boolean(props.project.pinned)}
          disabled={busy}
          onClick={() => void save({ pinned: !props.project.pinned })}
        >
          <ProjectIcon name="pin" />
        </button>
        <button
          className="a008-project-close"
          aria-label="Close project details"
          onClick={props.onClose}
        >
          ×
        </button>
      </header>
      <p>
        <ProjectIcon name="chat" />
        <span>
          {props.project.conversations.length}{" "}
          {props.project.conversations.length === 1 ? "chat" : "chats"}
        </span>
      </p>
      <p className="a008-project-path">
        <ProjectIcon name="folder" />
        <span>{props.project.rootFolder}</span>
      </p>
      <WorkspaceSessions project={props.project} onOpened={props.onWorkspaceOpened} />
      {!props.project.memory.useGlobalA008Memory ? (
        <p className="a008-project-storage-note">
          Chats are available until the host stops. Global memory is disabled
          for this project.
        </p>
      ) : null}
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save({ name: name.trim() });
          }}
        >
          <label>
            Project name
            <input
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button disabled={busy || !name.trim()}>Save</button>
          </div>
        </form>
      ) : (
        <button className="a008-project-edit" onClick={() => setEditing(true)}>
          <ProjectIcon name="settings" />
          Edit project
        </button>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </dialog>,
    document.body,
  );
}

export function ProjectSidebar(props: {
  session: GuiSession;
  revision: number;
  onManage: () => void;
  onOpened: () => Promise<void>;
  onChat: () => void;
}) {
  const [data, setData] = useState<SidebarData>({
    currentId: null,
    projects: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = useState<{
    project: Project;
    trigger: HTMLElement;
  }>();
  const request = useRef(0);
  const switching = useRef(false);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    try {
      const next = await listSidebarProjects(guiHttp());
      if (id === request.current) {
        setData(next);
        setError("");
      }
    } catch (caught) {
      if (id === request.current)
        setError(
          caught instanceof Error ? caught.message : "Could not load projects.",
        );
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      request.current++;
    };
  }, [
    refresh,
    props.revision,
    props.session.sessionId,
    props.session.details?.messages.length,
    props.session.model,
  ]);
  useEffect(() => {
    const reload = () => void refresh();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [refresh]);
  async function open(project: Project, action?: ProjectChatAction) {
    if (switching.current || props.session.busy) return;
    if (
      !action &&
      project.projectId === data.currentId &&
      props.session.status === "ready"
    ) {
      props.onChat();
      return;
    }
    if (
      action?.action === "open" &&
      project.projectId === data.currentId &&
      props.session.status === "ready" &&
      project.conversations.some(
        (chat) => chat.conversationId === action.conversationId && chat.current,
      )
    ) {
      props.onChat();
      return;
    }
    switching.current = true;
    setBusy(true);
    setError("");
    try {
      if (action) await changeProjectChat(guiHttp(), action);
      else await openProject(project.projectId);
      await props.onOpened();
      setCollapsed((old) => { const next = new Set(old); next.delete(project.projectId); return next; });
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not open chat.",
      );
    } finally {
      switching.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="a008-sidebar-projects" aria-label="Projects">
      <header>
        <button onClick={props.onManage}>
          <span aria-hidden="true">▣</span>Projects
        </button>
        <button
          aria-label="Add project"
          title="Add project"
          onClick={props.onManage}
        >
          <ProjectIcon name="plus" />
        </button>
      </header>
      <div className="a008-sidebar-project-scroll" aria-busy={loading || busy}>
        {loading ? (
          <p className="a008-project-empty">Loading projects…</p>
        ) : null}
        {!loading && !data.projects.length && !error ? (
          <button className="a008-project-add-empty" onClick={props.onManage}>
            Add your first project
          </button>
        ) : null}
        <ProjectList
          data={data}
          busy={busy || Boolean(props.session.busy)}
          collapsed={collapsed}
          onToggle={(id) =>
            setCollapsed((old) => {
              const next = new Set(old);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onOpen={(project, conversationId) =>
            void open(
              project,
              conversationId
                ? {
                    projectId: project.projectId,
                    action: "open",
                    conversationId,
                  }
                : undefined,
            )
          }
          onNew={(project) =>
            void open(project, { projectId: project.projectId, action: "new" })
          }
          onMenu={(project, trigger) => setMenu({ project, trigger })}
        />
        {error ? (
          <div className="a008-project-error" role="alert">
            <p>{error}</p>
            <button onClick={() => void refresh()}>Retry</button>
          </div>
        ) : null}
      </div>
      {menu ? (
        <ProjectDetails
          project={menu.project}
          trigger={menu.trigger}
          onClose={() => setMenu(undefined)}
          onWorkspaceOpened={async () => { await props.onOpened(); await refresh(); }}
          onSave={async (values) => {
            await updateProject(guiHttp(), {
              projectId: menu.project.projectId,
              ...values,
            });
            await refresh();
          }}
        />
      ) : null}
    </section>
  );
}
