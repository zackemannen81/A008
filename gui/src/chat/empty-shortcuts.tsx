export const EMPTY_SHORTCUTS = [
  { id: "review", label: "Review", keys: "Ctrl+Shift+G", icon: "±" },
  { id: "terminal", label: "Terminal", keys: "Ctrl+`", icon: "›_" },
  { id: "browser", label: "Browser", keys: "Ctrl+T", icon: "◎" },
  { id: "files", label: "Files", keys: "Ctrl+P", icon: "▣" },
  { id: "sidechat", label: "Workbench", keys: "Ctrl+Alt+S", icon: "+" },
] as const;

export type EmptyShortcutId = (typeof EMPTY_SHORTCUTS)[number]["id"];

export const SHORTCUT_DOCK_STORAGE_KEY = "a008.shortcutDock";

type DockStorage = Pick<Storage, "getItem" | "setItem">;

export function shortcutDockVisible(storage?: DockStorage): boolean {
  try {
    const store = storage ?? globalThis.localStorage;
    return store.getItem(SHORTCUT_DOCK_STORAGE_KEY) !== "hidden";
  } catch {
    return true;
  }
}

export function persistShortcutDockVisible(
  visible: boolean,
  storage?: DockStorage,
): void {
  try {
    const store = storage ?? globalThis.localStorage;
    store.setItem(SHORTCUT_DOCK_STORAGE_KEY, visible ? "visible" : "hidden");
  } catch {
    /* private mode or missing storage */
  }
}

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

export function ShortcutDock(props: {
  readonly hidden: boolean;
  readonly open: boolean;
  readonly onShortcut: (id: EmptyShortcutId) => void;
  readonly onOpen: () => void;
  readonly onHide: () => void;
}) {
  return (
    <aside
      className={`a008-shortcut-dock${props.open ? "" : " a008-shortcut-dock-collapsed"}`}
      hidden={props.hidden}
    >
      {props.open ? (
        <>
          <button
            type="button"
            className="a008-shortcut-hide"
            onClick={props.onHide}
          >
            Hide shortcuts
          </button>
          <EmptyShortcuts onShortcut={props.onShortcut} />
        </>
      ) : (
        <button
          type="button"
          className="a008-shortcut-show"
          onClick={props.onOpen}
        >
          Shortcuts
        </button>
      )}
    </aside>
  );
}
