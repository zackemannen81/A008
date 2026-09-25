import { useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { loadInstalledSkills, type InstalledSkill } from "../skills/skills.js";
import type { GuiSession, PromptImageAttachment } from "../session/types.js";
import { uploadSource, uploadSourcePath, type UploadedSource } from "../upload/upload-source.js";
import { runShellCommand } from "../terminal/terminal-pane.js";
import { submitComposer } from "./submit.js";

const CHAT_IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function firstImageFile(files: ArrayLike<File>): File | undefined {
  return Array.from(files).find((file) => CHAT_IMAGE_MEDIA_TYPES.has(file.type.toLowerCase()));
}

export function imageFileFromTransfer(transfer: Pick<DataTransfer, "files" | "items">): File | undefined {
  const file = firstImageFile(transfer.files);
  if (file !== undefined) return file;
  for (const item of Array.from(transfer.items)) {
    if (item.kind === "file" && CHAT_IMAGE_MEDIA_TYPES.has(item.type.toLowerCase())) {
      const fromItem = item.getAsFile();
      if (fromItem !== null) return fromItem;
    }
  }
  return undefined;
}

export function displayNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/u).filter((part) => part.length > 0);
  return parts.at(-1) ?? path;
}

/** A008 composer. Keep the Composer export. */
export function Composer(props: {
  readonly session: GuiSession;
  readonly onParameters?: () => void;
  readonly onImage?: (prompt: string) => void;
  readonly skill?: InstalledSkill;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const attachMenu = useRef<HTMLDetailsElement>(null);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<(PromptImageAttachment & { readonly name: string })>();
  const [localPath, setLocalPath] = useState("");
  const [showPathInput, setShowPathInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [skills, setSkills] = useState<readonly InstalledSkill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void loadInstalledSkills(controller.signal).then((next) => {
        if (!controller.signal.aborted) setSkills(next);
      }).catch(() => undefined);
    };
    refresh();
    window.addEventListener("a008-skills-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("a008-skills-changed", refresh);
    };
  }, []);
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId);

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
        ...(attachment === undefined ? {} : {
          attachment: { type: "image", locator: attachment.locator, mediaType: attachment.mediaType },
        }),
        ...(props.skill === undefined && selectedSkill === undefined ? {} : { skill: props.skill ?? selectedSkill }),
      });
      if (result.kind === "empty") {
        return;
      }
      if (result.kind === "error") {
        setError(result.message);
        return;
      }
      setDraft("");
      if (result.kind === "prompt") setAttachment(undefined);
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

  function acceptUploadedImage(uploaded: UploadedSource, name: string): void {
    if (!uploaded.mediaType.startsWith("image/")) {
      throw new Error(`Selected source is ${uploaded.mediaType}, not an image.`);
    }
    setAttachment({ type: "image", locator: uploaded.locator, mediaType: uploaded.mediaType, name });
  }

  async function attachImage(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    setUploading(true);
    setError("");
    try {
      const uploadable = file.name.trim().length > 0
        ? file
        : new File([file], "clipboard-image", { type: file.type });
      acceptUploadedImage(await uploadSource(uploadable), uploadable.name);
      if (attachMenu.current) attachMenu.current.open = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Image upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function attachLocalPath(): Promise<void> {
    const path = localPath.trim();
    if (path.length === 0) {
      setError("Enter an absolute local file path.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadSourcePath(path);
      acceptUploadedImage(uploaded, displayNameFromPath(path));
      setLocalPath("");
      setShowPathInput(false);
      if (attachMenu.current) attachMenu.current.open = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>): void {
    const image = imageFileFromTransfer(event.clipboardData);
    if (image === undefined) return;
    event.preventDefault();
    void attachImage(image);
  }

  function onDragOver(event: DragEvent<HTMLElement>): void {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function onDrop(event: DragEvent<HTMLElement>): void {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    const image = imageFileFromTransfer(event.dataTransfer);
    if (image === undefined) {
      setError("Drop a PNG, JPEG, WebP or GIF image.");
      return;
    }
    void attachImage(image);
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
    <section className="a008-composer" onDragOver={onDragOver} onDrop={onDrop}>
      <div className="a008-composer-card">
      <form className="a008-composer-form" onSubmit={onSubmit}>
        <div className="a008-composer-top">
        <label className="a008-composer-label" htmlFor={inputId}>
          Message
        </label>
        <textarea
          id={inputId}
          className="a008-composer-input"
          name="message"
          rows={1}
          value={draft}
          placeholder="Ask anything, or describe a task…"
          disabled={pending || props.session.busy || uploading}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
        />
        <button
          className="a008-composer-send"
          type="submit"
          disabled={pending || props.session.busy || uploading}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3.15 20.85 21 12 3.15 3.15l-.4 7.15L14.2 12l-11.45 1.7z"
            />
          </svg>
          Send
        </button>
        </div>
        {attachment ? (
          <div className="a008-composer-image-chip" role="status">
            <span>{attachment.name}</span>
            <small>{attachment.mediaType}</small>
            <button type="button" aria-label="Remove image attachment" onClick={() => setAttachment(undefined)}>×</button>
          </div>
        ) : uploading ? <p className="a008-composer-uploading" role="status">Attaching image…</p> : null}
        {showPathInput ? (
          <div className="a008-composer-path-row">
            <input
              type="text"
              value={localPath}
              aria-label="Local image path"
              placeholder="C:\\path\\to\\image.png"
              disabled={uploading || pending || props.session.busy}
              onChange={(event) => setLocalPath(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void attachLocalPath();
              }}
            />
            <button type="button" disabled={uploading || pending || props.session.busy} onClick={() => void attachLocalPath()}>Attach</button>
            <button type="button" disabled={uploading} onClick={() => { setShowPathInput(false); setLocalPath(""); }}>Cancel</button>
          </div>
        ) : null}
        <div className="a008-composer-tools">
          <input
            ref={fileInput}
            className="a008-composer-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-label="Choose image attachment"
            onChange={(event) => { void attachImage(event.currentTarget.files?.[0]); }}
          />
          <details ref={attachMenu} className="a008-composer-attach">
            <summary aria-label="Add">+</summary>
            <div className="a008-composer-attach-menu">
              <button type="button" disabled={uploading || pending || props.session.busy} onClick={() => {
                if (attachMenu.current) attachMenu.current.open = false;
                fileInput.current?.click();
              }}>Attach image</button>
              <button type="button" disabled={uploading || pending || props.session.busy} onClick={() => {
                setShowPathInput(true);
                if (attachMenu.current) attachMenu.current.open = false;
              }}>Attach from path</button>
              {props.onImage ? (
                <button
                  type="button"
                  onClick={() => {
                    if (draft.trim().length === 0) {
                      setError("Describe the image in the composer first.");
                      return;
                    }
                    if (attachMenu.current) attachMenu.current.open = false;
                    props.onImage?.(draft.trim());
                    setDraft("");
                  }}
                >
                  Generate image
                </button>
              ) : null}
            </div>
          </details>
        <select
          aria-label="Selected skill"
          value={selectedSkillId}
          disabled={pending || props.session.busy || uploading}
          onChange={(event) => setSelectedSkillId(event.target.value)}
        >
          <option value="">No skill</option>
          {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
        </select>
      <div className="a008-session-toolbar" aria-label="Session controls">
        <select
          aria-label="Session commands"
          value=""
          onChange={(event) => {
            void runCommand(event.target.value);
          }}
        >
          <option value="" disabled>
            Commands
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
        </div>
      </form>
      </div>
      <div className="a008-composer-footer">
        <span>Enter to send · Shift + Enter for a new line</span>
        <button type="button" onClick={props.onParameters} disabled={!props.onParameters} aria-label="Model parameters">{props.session.model ?? "Select model"}</button>
      </div>
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
