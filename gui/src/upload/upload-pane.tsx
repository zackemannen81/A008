import { useId, useRef, useState, type ChangeEvent } from "react";
import { UploadError, uploadSource, type UploadedSource } from "./upload-source.js";
import "./upload-pane.css";

type UploadStatus = "idle" | "uploading" | "done" | "error";

interface UploadState {
  readonly status: UploadStatus;
  readonly filename: string | undefined;
  readonly result: UploadedSource | undefined;
  readonly error: string | undefined;
}

const INITIAL_STATE: UploadState = {
  status: "idle",
  filename: undefined,
  result: undefined,
  error: undefined,
};

function errorMessage(error: unknown): string {
  if (error instanceof UploadError || error instanceof Error) {
    return error.message;
  }
  return "Upload failed.";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const unit = units[unitIndex] ?? "GB";
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

/**
 * One-file-at-a-time upload pane for `POST /v1/upload` (ADR 0020 D3). Shows
 * upload progress as busy/done/error, then whether the content was
 * extracted or the host's named reason it was not. No drag-and-drop, no
 * progress bar, no multi-file queue, and no rendering of document content —
 * those are explicitly out of scope for this module.
 */
export function UploadPane() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(INITIAL_STATE);

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    setState({
      status: "uploading",
      filename: file.name,
      result: undefined,
      error: undefined,
    });
    try {
      const result = await uploadSource(file);
      setState({
        status: "done",
        filename: file.name,
        result,
        error: undefined,
      });
    } catch (error) {
      setState({
        status: "error",
        filename: file.name,
        result: undefined,
        error: errorMessage(error),
      });
    } finally {
      if (inputRef.current !== null) {
        inputRef.current.value = "";
      }
    }
  }

  const busy = state.status === "uploading";

  return (
    <section className="a008-upload" aria-label="Upload" aria-busy={busy}>
      <h2>Upload</h2>
      <p>
        Attach one document or image at a time. It is sent to the A008 host
        over POST /v1/upload; the browser does not read or extract its
        content.
      </p>
      <label className="a008-upload-picker" htmlFor={inputId}>
        <span>Choose file</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          disabled={busy}
          aria-busy={busy}
          onChange={(event) => {
            void onFileChosen(event);
          }}
        />
      </label>
      <div className="a008-upload-status" role="status" data-status={state.status}>
        {state.status === "idle" ? (
          <p className="a008-upload-empty">No file uploaded yet.</p>
        ) : null}
        {state.status === "uploading" ? (
          <p className="a008-upload-uploading">{`Uploading ${state.filename ?? ""}...`}</p>
        ) : null}
        {state.status === "error" ? (
          <p className="a008-upload-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.status === "done" && state.result !== undefined ? (
          <dl className="a008-upload-result">
            <div>
              <dt>File</dt>
              <dd>{state.filename}</dd>
            </div>
            <div>
              <dt>Media type</dt>
              <dd>{state.result.mediaType}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(state.result.bytes)}</dd>
            </div>
            <div>
              <dt>Locator</dt>
              <dd className="a008-upload-locator">{state.result.locator}</dd>
            </div>
            <div>
              <dt>Extraction</dt>
              <dd
                className={
                  state.result.extracted
                    ? "a008-upload-extracted-yes"
                    : "a008-upload-extracted-no"
                }
              >
                {state.result.extracted
                  ? "Extracted"
                  : "Not extracted — stored, no readable content recorded"}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
