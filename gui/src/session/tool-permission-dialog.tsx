import { useEffect, useRef } from "react";
import type { GuiSession } from "./types.js";

export function ToolPermissionDialog({ session }: { session: GuiSession }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (session.permission) dialog.current?.showModal(); else dialog.current?.close();
  }, [session.permission?.id]);
  return <dialog ref={dialog} className="a008-tool-permission" aria-label="Approve tool execution"
    onCancel={event => { event.preventDefault(); session.resolveToolPermission?.("reject"); }}>
    <h2>{session.permission?.title}</h2>
    <p>The model requests this action on the A008 host.</p>
    <pre>{session.permission?.text}</pre>
    <footer><button autoFocus onClick={() => session.resolveToolPermission?.("reject")}>Reject</button>
      <button onClick={() => session.resolveToolPermission?.("allow_once")}>Allow once</button>
      <button onClick={() => session.resolveToolPermission?.("allow_all")}>Allow all</button></footer>
  </dialog>;
}
