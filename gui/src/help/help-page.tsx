import { RepositoryPane } from "../tools/repository-pane.js";
import type { GuiSession } from "../session/types.js";
import "./help.css";

export const HELP_SHORTCUTS = [
  { action: "Review working tree", keys: "Ctrl+Shift+G" },
  { action: "Open Terminal", keys: "Ctrl+`" },
  { action: "Open Browser", keys: "Ctrl+T" },
  { action: "Find files", keys: "Ctrl+P" },
  { action: "Toggle workbench", keys: "Ctrl+Alt+S" },
] as const;

export function HelpPage(props: {
  readonly session: GuiSession;
  readonly onChat: () => void;
}) {
  return (
    <section className="a008-help" aria-label="Help">
      <header className="a008-help-heading">
        <h1>Help</h1>
        <p>
          Tool catalog, shortcuts, and how repository work reaches the model.
          The Chat workbench is for git environment and sources, not this
          reference.
        </p>
      </header>
      <section className="a008-help-shortcuts" aria-label="Keyboard shortcuts">
        <h2>Shortcuts</h2>
        <ul>
          {HELP_SHORTCUTS.map((item) => (
            <li key={item.keys}>
              <span>{item.action}</span>
              <kbd>{item.keys}</kbd>
            </li>
          ))}
        </ul>
      </section>
      <RepositoryPane session={props.session} onChat={props.onChat} />
    </section>
  );
}
