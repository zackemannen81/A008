import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import type { GuiSession } from "../session/types.js";
import { runShellCommand } from "../terminal/terminal-pane.js";
import { submitComposer } from "./submit.js";

/** A008 composer. Keep the Composer export. */
export function Composer(props: { readonly session: GuiSession }) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function runCommand(command: string): Promise<void> {
    if (command === "/shell") {
      setDraft("/shell ");
      return;
    }
    setError("");
    setNotice("");
    try {
      const result = await submitComposer(command, {
        session: props.session,
        runShellCommand,
      });
      if (result.kind === "notice") setNotice(result.message);
      if (result.kind === "error") setError(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Command failed.");
    }
  }

  async function submitDraft(): Promise<void> {
    if (pending) {
      return;
    }
    if (draft.trim().length === 0) {
      return;
    }
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await submitComposer(draft, {
        session: props.session,
        runShellCommand,
      });
      if (result.kind === "empty") {
        return;
      }
      if (result.kind === "error") {
        setError(result.message);
        return;
      }
      setDraft("");
      if (result.kind === "notice") {
        setNotice(result.message);
        return;
      }
      setNotice("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Composer submit failed.",
      );
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitDraft();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitDraft();
    }
  }

  return (
    <section className="a008-composer">
      <div className="a008-session-toolbar" aria-label="Session controls">
        <select
          aria-label="Session commands"
          value=""
          onChange={(event) => {
            void runCommand(event.target.value);
          }}
        >
          <option value="" disabled>
            Session commands…
          </option>
          <option value="/help">Help /help</option>
          <option value="/history">History /history</option>
          <option value="/model">Models /model</option>
          <option value="/status">Status /status</option>
          <option value="/cwd">Working directory /cwd</option>
          <option value="/tools">Tools /tools</option>
          <option value="/shell">Shell command /shell</option>
          <option value="/reset">Reset /reset</option>
          <option value="/undo">Undo /undo</option>
          <option value="/exit">End session /exit</option>
        </select>
        <button
          type="button"
          disabled={props.session.status !== "ready" || props.session.busy}
          onClick={() => {
            void runCommand("/undo");
          }}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={props.session.status !== "ready" || props.session.busy}
          onClick={() => {
            void runCommand("/reset");
          }}
        >
          Reset
        </button>
        {props.session.status === "idle" || props.session.status === "error" ? (
          <button
            type="button"
            onClick={() => {
              void props.session.connect();
            }}
          >
            Connect
          </button>
        ) : null}
        {props.session.pendingText !== undefined ? (
          <button
            type="button"
            className="a008-stop"
            onClick={() => {
              void props.session
                .cancel()
                .catch((caught) =>
                  setError(
                    caught instanceof Error ? caught.message : "Cancel failed.",
                  ),
                );
            }}
          >
            Stop
          </button>
        ) : null}
      </div>
      <form className="a008-composer-form" onSubmit={onSubmit}>
        <label className="a008-composer-label" htmlFor={inputId}>
          Message
        </label>
        <textarea
          id={inputId}
          className="a008-composer-input"
          name="message"
          rows={3}
          value={draft}
          placeholder="Message or /help"
          disabled={pending || props.session.busy}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          className="a008-composer-send"
          type="submit"
          disabled={pending || props.session.busy}
        >
          Send
        </button>
      </form>
      {error.length > 0 ? (
        <p className="a008-composer-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice.length > 0 ? (
        <div className="a008-command-output">
          <button
            type="button"
            aria-label="Dismiss command output"
            onClick={() => setNotice("")}
          >
            ×
          </button>
          <pre className="a008-composer-notice" role="status">
            {notice}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
