import { useEffect, useRef, useState } from "react";
import { ToolPermissionDialog } from "./session/tool-permission-dialog.js";
import { ToolActivity } from "./tools/repository-pane.js";
import { ParametersPanel } from "./settings/parameters-panel.js";
import { BrandMark } from "./brand/brand-mark.js";
import { ChatPane, type ChatGeneratedImage } from "./chat/chat-pane.js";
import { EmptyShortcuts, type EmptyShortcutId } from "./chat/empty-shortcuts.js";
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

const STATUS_LABEL = {
  idle: "Not connected",
  connecting: "Connecting",
  ready: "Connected",
  error: "Runtime error",
};
const REVIEW_PROMPT =
  "Granska ändringarna i arbetskopian med git status, git diff och git diff --cached. Läs berörda filer vid behov och sammanfatta fynden.";

type Page = "chat" | "memory" | "tools" | "help";
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
  const [toolSurface, setToolSurface] = useState<ToolSurface>("terminal");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sources, setSources] = useState<readonly SessionSource[]>([]);
  const [images, setImages] = useState<readonly ChatGeneratedImage[]>([]);
  const [imageError, setImageError] = useState("");
  const cwd = session.details?.runtime.cwd;
  const workspace = cwd?.split(/[\\/]/u).filter(Boolean).at(-1);

  function navigate(next: Page) {
    setPage(next);
    setNavigationOpen(false);
    if (next === "chat") setToolsOpen(false);
  }

  function openTools(surface: ToolSurface) {
    setToolSurface(surface);
    setPage("tools");
    setToolsOpen(false);
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

  function onShortcut(id: EmptyShortcutId) {
    if (id === "review") void ask(REVIEW_PROMPT);
    if (id === "terminal") openTools("terminal");
    if (id === "browser") openTools("browser");
    if (id === "files") {
      setPage("chat");
      setFilesOpen((open) => !open);
    }
    if (id === "sidechat") {
      setPage("chat");
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
        <p className="a008-sidebar-footer">A008 · Local engine</p>
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
              aria-expanded={filesOpen}
              aria-controls="a008-files-panel"
              onClick={() => setFilesOpen(!filesOpen)}
            >
              Files
            </button>
            <button
              className="a008-panel-toggle"
              aria-expanded={toolsOpen}
              aria-controls="a008-tools-panel"
              onClick={() => setToolsOpen(!toolsOpen)}
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
          images={images}
        />
        {imageError ? <p className="a008-chat-error" role="alert">{imageError}</p> : null}
        <ToolActivity session={session} />
        <Composer
          session={session}
          onParameters={openParameters}
          onImage={(prompt) => {
            setImageError("");
            void generateImage(prompt)
              .then((image) => {
                setImages((current) => [
                  ...current,
                  {
                    id: image.locator,
                    prompt,
                    src: generatedImageSrc(image),
                  },
                ]);
              })
              .catch((reason) => {
                setImageError(
                  reason instanceof Error ? reason.message : "Image generation failed.",
                );
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
      <aside
        className="a008-shortcut-dock"
        hidden={page !== "chat" || filesOpen || toolsOpen}
      >
        <EmptyShortcuts onShortcut={onShortcut} />
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
