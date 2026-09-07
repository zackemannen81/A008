export const EMPTY_SHORTCUTS = [
  { id: "review", label: "Review", keys: "Ctrl+Shift+G", icon: "±" },
  { id: "terminal", label: "Terminal", keys: "Ctrl+`", icon: "›_" },
  { id: "browser", label: "Browser", keys: "Ctrl+T", icon: "◎" },
  { id: "files", label: "Files", keys: "Ctrl+P", icon: "▣" },
  { id: "sidechat", label: "Workbench", keys: "Ctrl+Alt+S", icon: "+" },
] as const;

export type EmptyShortcutId = (typeof EMPTY_SHORTCUTS)[number]["id"];

export function EmptyShortcuts(props: {
  readonly onShortcut: (id: EmptyShortcutId) => void;
}) {
  return (
    <ul className="a008-empty-shortcuts" aria-label="Workbench shortcuts">
      {EMPTY_SHORTCUTS.map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => props.onShortcut(item.id)}>
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
            <kbd>{item.keys}</kbd>
          </button>
        </li>
      ))}
    </ul>
  );
}
