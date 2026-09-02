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
          disabled={pending}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          className="a008-composer-send"
          type="submit"
          disabled={pending}
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
        <pre className="a008-composer-notice">{notice}</pre>
      ) : null}
    </section>
  );
}
