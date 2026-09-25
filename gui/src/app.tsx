import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ToolPermissionDialog } from "./session/tool-permission-dialog.js";
import { ParametersPanel } from "./settings/parameters-panel.js";
import { BrandMark } from "./brand/brand-mark.js";
import { ChatPane } from "./chat/chat-pane.js";
import {
  ShortcutDock,
  type EmptyShortcutId,
} from "./chat/empty-shortcuts.js";
import { Composer } from "./composer/composer.js";
import { useGuiSession } from "./session/use-gui-session.js";
import { SettingsPane } from "./settings/settings-pane.js";
import { TerminalPane } from "./terminal/terminal-pane.js";
import { UploadPane } from "./upload/upload-pane.js";
import { Workbench } from "./workbench/workbench.js";
import {
  EnvironmentPanel,
  type SessionSource,
} from "./workbench/environment-panel.js";
import { MemoryPage } from "./memory/memory-page.js";
import { HelpPage } from "./help/help-page.js";
import { BrowserPane } from "./browser/browser-pane.js";
import { FilesPane } from "./files/files-pane.js";
import {
  CodeArtifactPanel,
  type CodeArtifactView,
} from "./artifact/code-artifact-panel.js";
import type { HtmlArtifactCandidate } from "./artifact/code-artifact.js";
import { ProjectsPage } from "./projects/projects-page.js";
import { ProjectSidebar } from "./projects/project-sidebar.js";
import { PlatformPage } from "./platform/platform-page.js";
import {
  clampSidebarWidth,
  persistSidebarHidden,
  persistSidebarWidth,
  readSidebarHidden,
  readSidebarWidth,
} from "./brand/sidebar-state.js";

const STATUS_LABEL = {
  idle: "Not connected",
  connecting: "Connecting",
  ready: "Connected",
  error: "Runtime error",
};
const REVIEW_PROMPT =
  "Granska ändringarna i arbetskopian med git status, git diff och git diff --cached. Läs berörda filer vid behov och sammanfatta fynden.";

type Page = "chat" | "memory" | "tools" | "help" | "projects" | "platform";
const PAGE_TITLE: Record<Page, string> = {
  chat: "Conversation",
  memory: "Memory",
  tools: "Tools",
  help: "Help",
  projects: "Projects",
  platform: "Platform",
};
type ToolSurface = "terminal" | "files" | "browser" | "upload";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/** Persistent navigation, focused conversation and an optional workbench. */
export function App() {
  const session = useGuiSession();
  const [parametersOpen, setParametersOpen] = useState(false);
  const parametersButton = useRef<HTMLButtonElement>(null);
  const parametersTrigger = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState<Page>("chat");
  const [projectsRevision, setProjectsRevision] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [toolSurface, setToolSurface] = useState<ToolSurface>("terminal");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [sidebarHidden, setSidebarHidden] = useState(readSidebarHidden);
  const [applicationMenu, setApplicationMenu] = useState<"file" | "edit" | "view" | "help">();
  const [sources, setSources] = useState<readonly SessionSource[]>([]);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [artifact, setArtifact] = useState<CodeArtifactView>();
  const [pendingArtifact, setPendingArtifact] = useState<HtmlArtifactCandidate>();
  const artifactSessionId = useRef<string | undefined>(session.sessionId);
  const cwd = session.details?.runtime.cwd;
  const workspace = cwd?.split(/[\\/]/u).filter(Boolean).at(-1);

  useEffect(() => {
    if (artifactSessionId.current === session.sessionId) return;
    artifactSessionId.current = session.sessionId;
    setArtifact(undefined);
    setPendingArtifact(undefined);
    setCanvasOpen(false);
  }, [session.sessionId]);

  function toggleSidebar() {
    setSidebarHidden((hidden) => {
      persistSidebarHidden(!hidden);
      return !hidden;
    });
  }

  function resizeSidebar(nextWidth: number) {
    const width = clampSidebarWidth(nextWidth);
    setSidebarWidth(width);
    persistSidebarWidth(width);
  }

  function beginSidebarResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const move = (moveEvent: PointerEvent) => resizeSidebar(startWidth + moveEvent.clientX - startX);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  }

  function runMenuAction(action: "new-chat" | "files" | "parameters" | "toggle-sidebar" | "help") {
    setApplicationMenu(undefined);
    if (action === "new-chat") navigate("chat");
    if (action === "files") openTools("files");
    if (action === "parameters") openParameters();
    if (action === "toggle-sidebar") toggleSidebar();
    if (action === "help") navigate("help");
  }

  const committedMessageCount = session.details?.messages.length;
  useEffect(() => {
    if (committedMessageCount !== 0) return;
    setArtifact(undefined);
    setPendingArtifact(undefined);
  }, [committedMessageCount]);

  function navigate(next: Page) {
    setPage(next);
    setNavigationOpen(false);
    if (next === "chat") setToolsOpen(false);
    else setCanvasOpen(false);
  }

  async function projectOpened() {
    await Promise.resolve(session.endSession?.()).catch(() => undefined);
    await session.connect();
    setProjectsRevision((revision) => revision + 1);
    navigate("chat");
  }

  function openTools(surface: ToolSurface) {
    setToolSurface(surface);
    setPage("tools");
    setToolsOpen(false);
    setCanvasOpen(false);
    setNavigationOpen(false);
  }

  function openParameters() {
    parametersTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setParametersOpen(true);
  }

  async function ask(prompt: string) {
    navigate("chat");
    try {
      await session.prompt(prompt);
    } catch {
      // Session error is rendered by ChatPane.
    }
  }

  function modelArtifact(next: HtmlArtifactCandidate): CodeArtifactView {
    return { sourceTurnId: next.sourceTurnId, source: next.source, modelSource: next.source, dirty: false };
  }

  function openArtifact(next: HtmlArtifactCandidate) {
    setArtifact(modelArtifact(next));
    setPendingArtifact(undefined);
    setCanvasOpen(true);
    setFilesOpen(false);
    setToolsOpen(false);
  }

  function considerArtifact(next: HtmlArtifactCandidate) {
    if (!artifact) {
      if (canvasOpen) setArtifact(modelArtifact(next));
      return;
    }
    if (next.sourceTurnId === artifact.sourceTurnId && next.source === artifact.modelSource) return;
    if (artifact.dirty) {
      setPendingArtifact(next);
      return;
    }
    setArtifact(modelArtifact(next));
    setPendingArtifact(undefined);
  }

  function onShortcut(id: EmptyShortcutId) {
    if (id === "review") void ask(REVIEW_PROMPT);
    if (id === "terminal") openTools("terminal");
    if (id === "browser") openTools("browser");
    if (id === "files") {
      setPage("chat");
      setCanvasOpen(false);
      setFilesOpen((open) => !open);
    }
    if (id === "sidechat") {
      setPage("chat");
      setCanvasOpen(false);
      setToolsOpen((open) => !open);
    }
  }
  const shortcutRef = useRef(onShortcut);
  shortcutRef.current = onShortcut;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.isComposing) return;
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "g") {
        event.preventDefault();
        shortcutRef.current("review");
        return;
      }
      if (event.altKey && key === "s") {
        event.preventDefault();
        shortcutRef.current("sidechat");
        return;
      }
      if (isTypingTarget(event.target) && !event.altKey && !event.shiftKey) {
        if (key !== "`") return;
      }
      if (key === "`" && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        shortcutRef.current("terminal");
      } else if (key === "t" && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        shortcutRef.current("browser");
      } else if (key === "p" && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        shortcutRef.current("files");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={`a008-app a008-${page}-workspace${toolsOpen ? " a008-panel-open" : ""}${navigationOpen ? " a008-navigation-open" : ""}${sidebarHidden ? " a008-sidebar-hidden" : ""}`}
      style={{ "--a008-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <div className="a008-crt-overlay" aria-hidden="true" />
      <ToolPermissionDialog session={session} />
      <aside className="a008-rail" id="a008-navigation" aria-label="Workspace navigation">
        <div className="a008-sidebar-brand">
          <BrandMark />
        </div>
        <nav className="a008-sidebar-nav" aria-label="Workspace">
          <button
            aria-current={page === "chat" ? "page" : undefined}
            onClick={() => navigate("chat")}
          >
            <span aria-hidden="true">◌</span> Chat
          </button>
          <button
            aria-current={page === "memory" ? "page" : undefined}
            onClick={() => navigate("memory")}
          >
            <span aria-hidden="true">◇</span> Memory
          </button>
          <button
            aria-current={page === "tools" ? "page" : undefined}
            onClick={() => navigate("tools")}
          >
            <span aria-hidden="true">⌘</span> Tools
          </button>
          <button
            aria-current={page === "help" ? "page" : undefined}
            onClick={() => navigate("help")}
          >
            <span aria-hidden="true">?</span> Help
          </button>
          <button
            aria-current={page === "platform" ? "page" : undefined}
            onClick={() => navigate("platform")}
          >
            <span aria-hidden="true">▣</span> Platform
          </button>
        </nav>
        <ProjectSidebar
          session={session}
          revision={projectsRevision}
          onManage={() => navigate("projects")}
          onOpened={projectOpened}
          onChat={() => navigate("chat")}
        />
        <details className="a008-runtime-details">
          <summary>Runtime details</summary>
          <div className="a008-sidebar-workspace">
            <p className="a008-sidebar-caption">Workspace</p>
            <p className="a008-workspace-name" title={cwd}>
              {workspace ?? "Local workspace"}
            </p>
            <p className="a008-sidebar-hint">
              {cwd ?? "Connect to see your working directory."}
            </p>
          </div>
          <SettingsPane session={session} />
        </details>
        <div className="a008-sidebar-footer">
          <img
            className="a008-certified"
            src="/acme-engine-certified.png"
            alt="Running ACME-engine certified"
            width={120}
            height={120}
          />
          <p>A008 · Local-engine</p>
        </div>
      </aside>
      <button
        type="button"
        className="a008-sidebar-resizer"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        role="separator"
        aria-valuemin={208}
        aria-valuemax={480}
        aria-valuenow={sidebarWidth}
        onPointerDown={beginSidebarResize}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") resizeSidebar(sidebarWidth - 16);
          else if (event.key === "ArrowRight") resizeSidebar(sidebarWidth + 16);
          else if (event.key === "Home") resizeSidebar(208);
          else if (event.key === "End") resizeSidebar(480);
          else return;
          event.preventDefault();
        }}
      />
      <header className="a008-header">
        <div className="a008-header-title">
          <button
            className="a008-navigation-toggle"
            aria-label="Toggle navigation"
            aria-expanded={navigationOpen}
            aria-controls="a008-navigation"
            onClick={() => setNavigationOpen(!navigationOpen)}
          >
            ☰
          </button>
          <button
            className="a008-sidebar-toggle"
            aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
            title={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={!sidebarHidden}
            onClick={toggleSidebar}
          >
            {sidebarHidden ? "▸" : "◂"}
          </button>
          <span>{PAGE_TITLE[page]}</span>
          <span className="a008-header-workspace">{workspace}</span>
        </div>
        <nav className="a008-application-menu" aria-label="Application menu">
          {([
            ["file", "File", [["new-chat", "New chat"], ["files", "Files"]]],
            ["edit", "Edit", [["parameters", "Parameters"]]],
            ["view", "View", [["toggle-sidebar", sidebarHidden ? "Show sidebar" : "Hide sidebar"]]],
            ["help", "Help", [["help", "Help"]]],
          ] as const).map(([id, label, items]) => (
            <div key={id} className="a008-menu-group">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={applicationMenu === id}
                onClick={() => setApplicationMenu(applicationMenu === id ? undefined : id)}
              >
                {label}
              </button>
              {applicationMenu === id ? (
                <div role="menu" className="a008-menu-popup">
                  {items.map(([action, itemLabel]) => (
                    <button key={action} type="button" role="menuitem" onClick={() => runMenuAction(action)}>
                      {itemLabel}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="a008-header-actions">
          <p className="a008-header-status">
            <span
              className={`a008-connection-dot a008-connection-${session.status}`}
              aria-hidden="true"
            />
            {STATUS_LABEL[session.status]}
          </p>
          <button
            className="a008-parameters-open"
            ref={parametersButton}
            onClick={openParameters}
            aria-haspopup="dialog"
          >
            Parameters
          </button>
          {page === "chat" ? (
            <>
            <button
              className="a008-panel-toggle"
              aria-expanded={canvasOpen}
              aria-controls="a008-code-canvas-panel"
              onClick={() => {
                setCanvasOpen(!canvasOpen);
                setFilesOpen(false);
                setToolsOpen(false);
                setShortcutsOpen(false);
              }}
            >
              Canvas{artifact ? " •" : ""}
            </button>
            <button
              className="a008-panel-toggle"
              aria-expanded={filesOpen}
              aria-controls="a008-files-panel"
              onClick={() => {
                setFilesOpen(!filesOpen);
                setCanvasOpen(false);
                setShortcutsOpen(false);
              }}
            >
              Files
            </button>
            <button
              className="a008-panel-toggle"
              aria-expanded={toolsOpen}
              aria-controls="a008-tools-panel"
              onClick={() => {
                setToolsOpen(!toolsOpen);
                setCanvasOpen(false);
                setShortcutsOpen(false);
              }}
            >
              Workbench
            </button>
            <button
              type="button"
              className="a008-shortcuts-trigger"
              aria-label="Shortcuts"
              title="Shortcuts"
              aria-expanded={shortcutsOpen}
              aria-controls="a008-shortcut-dock"
              onClick={() => {
                setShortcutsOpen((open) => !open);
                setFilesOpen(false);
                setToolsOpen(false);
                setCanvasOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7 17 17M10 17h7v-7" />
              </svg>
            </button>
            </>
          ) : null}
        </div>
      </header>
      <main className="a008-main" hidden={page !== "chat"}>
        <ChatPane
          session={session}
          onStartPrompt={(prompt) => void ask(prompt)}
          onArtifactOpen={openArtifact}
          onArtifactCandidate={considerArtifact}
        />
        <Composer
          session={session}
          onParameters={openParameters}
          onImage={(prompt) => {
            const work = session.generateImage?.(prompt);
            void work?.catch(() => undefined);
          }}
        />
      </main>
      <main className="a008-memory-main" hidden={page !== "memory"}>
        <MemoryPage active={page === "memory"} />
      </main>
      <main className="a008-help-main" hidden={page !== "help"}>
        <HelpPage session={session} onChat={() => navigate("chat")} />
      </main>
      <main className="a008-help-main" hidden={page !== "projects"}>
        <ProjectsPage
          active={page === "projects"}
          onOpened={() => void projectOpened()}
        />
      </main>
      <main className="a008-help-main" hidden={page !== "platform"}>
        <PlatformPage active={page === "platform"} model={session.model} />
      </main>
      <ShortcutDock
        hidden={page !== "chat" || filesOpen || toolsOpen || canvasOpen}
        open={shortcutsOpen}
        onShortcut={onShortcut}
        onClose={() => setShortcutsOpen(false)}
      />
      <aside
        className="a008-code-canvas-float"
        id="a008-code-canvas-panel"
        hidden={page !== "chat" || !canvasOpen}
      >
        <CodeArtifactPanel
          artifact={artifact}
          pending={pendingArtifact}
          onClose={() => setCanvasOpen(false)}
          onPrompt={(prompt) => void ask(prompt)}
          onSourceChange={(source) => setArtifact((current) => current ? {
            ...current,
            source,
            dirty: source !== current.modelSource,
          } : current)}
          onRevert={() => setArtifact((current) => current ? {
            ...current,
            source: current.modelSource,
            dirty: false,
          } : current)}
          onUseModelUpdate={() => {
            if (!pendingArtifact) return;
            setArtifact(modelArtifact(pendingArtifact));
            setPendingArtifact(undefined);
          }}
        />
      </aside>
      <aside
        className="a008-files-float"
        id="a008-files-panel"
        hidden={page !== "chat" || !filesOpen}
      >
        <FilesPane
          session={session}
          onOpen={(path) =>
            void ask(`Läs filen ${path} med read_file och sammanfatta vad den innehåller.`)
          }
        />
      </aside>
      <aside
        className="a008-environment-float"
        id="a008-tools-panel"
        hidden={page !== "chat" || !toolsOpen}
      >
        <EnvironmentPanel
          session={session}
          sources={sources}
          onSources={(next) => setSources(next)}
          onChat={() => navigate("chat")}
          onShowAllSources={() => openTools("upload")}
        />
      </aside>
      <div className="a008-tools-panel" hidden={page !== "tools"}>
        <Workbench
          label="Tools"
          selectedId={toolSurface}
          onSelect={(id) => setToolSurface(id as ToolSurface)}
          surfaces={[
            {
              id: "terminal",
              label: "Terminal",
              render: () => <TerminalPane />,
            },
            {
              id: "files",
              label: "Files",
              render: () => (
                <FilesPane
                  session={session}
                  onOpen={(path) =>
                    void ask(
                      `Läs filen ${path} med read_file och sammanfatta vad den innehåller.`,
                    )
                  }
                />
              ),
            },
            {
              id: "browser",
              label: "Browser",
              render: () => <BrowserPane />,
            },
            { id: "upload", label: "Upload", render: () => <UploadPane /> },
          ]}
        />
      </div>
      {parametersOpen ? (
        <ParametersPanel
          session={session}
          onClose={() => {
            setParametersOpen(false);
            (parametersTrigger.current ?? parametersButton.current)?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
