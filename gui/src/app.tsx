import { BrandMark } from "./brand/brand-mark.js";
import { ChatPane } from "./chat/chat-pane.js";
import { Composer } from "./composer/composer.js";
import { useGuiSession } from "./session/use-gui-session.js";
import { SettingsPane } from "./settings/settings-pane.js";
import { TerminalPane } from "./terminal/terminal-pane.js";

export function App() {
  const session = useGuiSession();
  return (
    <div className="a008-app">
      <header className="a008-header">
        <BrandMark />
      </header>
      <main className="a008-main">
        <ChatPane session={session} />
        <Composer session={session} />
        <TerminalPane />
      </main>
      <aside className="a008-aside">
        <SettingsPane session={session} />
      </aside>
    </div>
  );
}
