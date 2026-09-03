import { BrandMark } from "./brand/brand-mark.js";
import { ChatPane } from "./chat/chat-pane.js";
import { Composer } from "./composer/composer.js";
import { useGuiSession } from "./session/use-gui-session.js";
import { SettingsPane } from "./settings/settings-pane.js";
import { TerminalPane } from "./terminal/terminal-pane.js";
import { UploadPane } from "./upload/upload-pane.js";
import { Workbench } from "./workbench/workbench.js";

const STATUS_LABEL: Record<string, string> = {
  idle: "not connected",
  connecting: "connecting",
  ready: "connected",
  error: "runtime error",
};

/**
 * The A008 workspace shell (ADR 0021 D1).
 *
 * Three zones under a full-width header: the rail carries identity and runtime
 * facts, the centre carries the conversation and nothing else, and the
 * workbench carries every other surface as a tab.
 *
 * The centre is deliberately single-purpose. A008's primary act is a
 * conversation, and the previous shell stacked four panes in one column and
 * left the transcript a quarter of the height.
 */
export function App() {
  const session = useGuiSession();
  return (
    <div className="a008-app">
      <header className="a008-header">
        <BrandMark />
        <nav className="a008-header-tabs" aria-label="Workspace" />
        <p className="a008-header-status">
          <span
            className={`a008-connection-dot a008-connection-${session.status}`}
            aria-hidden="true"
          />
          {STATUS_LABEL[session.status] ?? session.status}
        </p>
      </header>

      <aside className="a008-rail" aria-label="Runtime">
        <SettingsPane session={session} />
      </aside>

      <main className="a008-main">
        <ChatPane session={session} />
        <Composer session={session} />
      </main>

      <Workbench
        label="Workbench"
        surfaces={[
          { id: "terminal", label: "Terminal", render: () => <TerminalPane /> },
          { id: "upload", label: "Upload", render: () => <UploadPane /> },
        ]}
      />
    </div>
  );
}
