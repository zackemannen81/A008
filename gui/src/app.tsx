import { useEffect, useRef, useState } from "react";
import { ToolPermissionDialog } from "./session/tool-permission-dialog.js";
import { ParametersPanel } from "./settings/parameters-panel.js";
import { BrandMark } from "./brand/brand-mark.js";
import { ChatPane, type ChatGeneratedImage } from "./chat/chat-pane.js";
import { buildChatTranscript } from "./chat/chat-transcript.js";
import {
  persistShortcutDockVisible,
  ShortcutDock,
  shortcutDockVisible,
  type EmptyShortcutId,
} from "./chat/empty-shortcuts.js";
import { Composer } from "./composer/composer.js";
import { generateImage, generatedImageSrc } from "./images/generate-image.js";
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

const STATUS_LABEL = {
  idle: "Not connected",
  connecting: "Connecting",
  ready: "Connected",
  error: "Runtime error",
};
const REVIEW_PROMPT =
  "Granska ändringarna i arbetskopian med git status, git diff och git diff --cached. Läs berörda filer vid behov och sammanfatta fynden.";

type Page = "chat" | "memory" | "tools" | "help" | "projects";
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(() => shortcutDockVisible());
  const [toolSurface, setToolSurface] = useState<ToolSurface>("terminal");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sources, setSources] = useState<readonly SessionSource[]>([]);
  const [images, setImages] = useState<readonly ChatGeneratedImage[]>([]);
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
      className={`a008-app a008-${page}-workspace${toolsOpen ? " a008-panel-open" : ""}${navigationOpen ? " a008-navigation-open" : ""}`}
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
            aria-current={page === "projects" ? "page" : undefined}
            onClick={() => navigate("projects")}
          >
            <span aria-hidden="true">▣</span> Projects
          </button>
        </nav>
        <div className="a008-sidebar-workspace">
          <p className="a008-sidebar-caption">Workspace</p>
          <p className="a008-workspace-name" title={cwd}>
            {workspace ?? "Local workspace"}
          </p>
          <p className="a008-sidebar-hint">
            {cwd ?? "Connect to see your working directory."}
          </p>
        </div>
        <details className="a008-runtime-details">
          <summary>Runtime details</summary>
          <SettingsPane session={session} />
        </details>
        <div className="a008-sidebar-footer">
          <img
            className="a008-certified"
            src="/acme-engine-certified.png"
            alt="Running ACME-engine certified"
            width={1280}
            height={1164}
          />
          <p>A008 · Local-engine</p>
        </div>
      </aside>
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
          <span>
            {page === "chat"
              ? "Conversation"
              : page === "memory"
                ? "Memory"
                : page === "help"
                  ? "Help"
                  : page === "projects"
                    ? "Projects"
                    : "Tools"}
          </span>
          <span className="a008-header-workspace">{workspace}</span>
        </div>
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
              }}
            >
              Workbench
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
          images={images}
        />
        <Composer
          session={session}
          onParameters={openParameters}
          onImage={(prompt) => {
            const id = crypto.randomUUID();
            // Reserve the transcript position before the provider operation starts.
            const position = buildChatTranscript({ session }).turns.length;
            setImages((current) => [
              ...current,
              { id, prompt, position, status: "pending" },
            ]);
            void generateImage(prompt)
              .then((image) => {
                setImages((current) => current.map((entry) =>
                  entry.id === id
                    ? { ...entry, status: "completed", src: generatedImageSrc(image) }
                    : entry,
                ));
              })
              .catch((reason) => {
                setImages((current) => current.map((entry) =>
                  entry.id === id
                    ? {
                        ...entry,
                        status: "failed",
                        error: reason instanceof Error ? reason.message : "Image generation failed.",
                      }
                    : entry,
                ));
              });
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
          onOpened={() => {
            void Promise.resolve(session.endSession?.())
              .catch(() => undefined)
              .finally(() => {
                void session.connect();
              });
            navigate("chat");
          }}
        />
      </main>
      <ShortcutDock
        hidden={page !== "chat" || filesOpen || toolsOpen || canvasOpen}
        open={shortcutsOpen}
        onShortcut={onShortcut}
        onHide={() => {
          setShortcutsOpen(false);
          persistShortcutDockVisible(false);
        }}
        onOpen={() => {
          setShortcutsOpen(true);
          setFilesOpen(false);
          setToolsOpen(false);
          setCanvasOpen(false);
          persistShortcutDockVisible(true);
        }}
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
