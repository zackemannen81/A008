import { useRef, useState } from "react";
import { ToolPermissionDialog } from "./session/tool-permission-dialog.js";
import { RepositoryPane, ToolActivity } from "./tools/repository-pane.js";
import { ParametersPanel } from "./settings/parameters-panel.js";
import { BrandMark } from "./brand/brand-mark.js";
import { ChatPane } from "./chat/chat-pane.js";
import { Composer } from "./composer/composer.js";
import { useGuiSession } from "./session/use-gui-session.js";
import { SettingsPane } from "./settings/settings-pane.js";
import { TerminalPane } from "./terminal/terminal-pane.js";
import { UploadPane } from "./upload/upload-pane.js";
import { Workbench } from "./workbench/workbench.js";
import { MemoryPage } from "./memory/memory-page.js";

const STATUS_LABEL = { idle: "Not connected", connecting: "Connecting", ready: "Connected", error: "Runtime error" };

/** Persistent navigation, focused conversation and an optional workbench. */
export function App() {
  const session = useGuiSession();
  const [parametersOpen, setParametersOpen] = useState(false);
  const parametersButton = useRef<HTMLButtonElement>(null);
  const parametersTrigger = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState<"chat" | "memory" | "tools">("chat");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const cwd = session.details?.runtime.cwd;
  const workspace = cwd?.split(/[\\/]/u).filter(Boolean).at(-1);
  function navigate(next: typeof page) {
    setPage(next);
    setNavigationOpen(false);
    if (next === "chat") setToolsOpen(false);
  }
  function openParameters() {
    parametersTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setParametersOpen(true);
  }
  return (
    <div className={`a008-app a008-${page}-workspace${toolsOpen ? " a008-panel-open" : ""}${navigationOpen ? " a008-navigation-open" : ""}`}>
      <ToolPermissionDialog session={session} />
      <aside className="a008-rail" id="a008-navigation" aria-label="Workspace navigation">
        <div className="a008-sidebar-brand"><BrandMark /></div>
        <nav className="a008-sidebar-nav" aria-label="Workspace">
          <button aria-current={page === "chat" ? "page" : undefined} onClick={() => navigate("chat")}><span aria-hidden="true">◷</span> Chat</button>
          <button aria-current={page === "memory" ? "page" : undefined} onClick={() => navigate("memory")}><span aria-hidden="true">◇</span> Memory</button>
          <button aria-current={page === "tools" ? "page" : undefined} onClick={() => navigate("tools")}><span aria-hidden="true">⌘</span> Tools</button>
        </nav>
        <div className="a008-sidebar-workspace">
          <p className="a008-sidebar-caption">Workspace</p>
          <p className="a008-workspace-name" title={cwd}>{workspace ?? "Local workspace"}</p>
          <p className="a008-sidebar-hint">{cwd ?? "Connect to see your working directory."}</p>
        </div>
        <details className="a008-runtime-details">
          <summary>Runtime details</summary>
          <SettingsPane session={session} />
        </details>
        <p className="a008-sidebar-footer">A008 · Local engine</p>
      </aside>
      <header className="a008-header">
        <div className="a008-header-title">
          <button className="a008-navigation-toggle" aria-label="Toggle navigation" aria-expanded={navigationOpen} aria-controls="a008-navigation" onClick={() => setNavigationOpen(!navigationOpen)}>☰</button>
          <span>{page === "chat" ? "Conversation" : page === "memory" ? "Memory" : "Tools"}</span>
          <span className="a008-header-workspace">{workspace}</span>
        </div>
        <div className="a008-header-actions">
          <p className="a008-header-status"><span className={`a008-connection-dot a008-connection-${session.status}`} aria-hidden="true" />{STATUS_LABEL[session.status]}</p>
          <button className="a008-parameters-open" ref={parametersButton} onClick={openParameters} aria-haspopup="dialog">Parameters</button>
          {page === "chat" ? <button className="a008-panel-toggle" aria-expanded={toolsOpen} aria-controls="a008-tools-panel" onClick={() => setToolsOpen(!toolsOpen)}>Workbench</button> : null}
        </div>
      </header>
      <main className="a008-main" hidden={page !== "chat"}>
        <ChatPane session={session} />
        <ToolActivity session={session} />
        <Composer session={session} onParameters={openParameters} />
      </main>
      <main className="a008-memory-main" hidden={page !== "memory"}>
        <MemoryPage active={page === "memory"} />
      </main>
      <div className="a008-tools-panel" id="a008-tools-panel" hidden={page !== "tools" && !(page === "chat" && toolsOpen)}>
        <Workbench label="Workbench" surfaces={[
          { id: "repository", label: "Repository", render: () => <RepositoryPane session={session} onChat={() => navigate("chat")} /> },
          { id: "terminal", label: "Terminal", render: () => <TerminalPane /> },
          { id: "upload", label: "Upload", render: () => <UploadPane /> },
        ]} />
      </div>
      {parametersOpen ? <ParametersPanel session={session} onClose={() => {
        setParametersOpen(false);
        (parametersTrigger.current ?? parametersButton.current)?.focus();
      }} /> : null}
    </div>
  );
}
