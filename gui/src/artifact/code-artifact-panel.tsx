import { useMemo, useState } from "react";
import {
  CODE_PREVIEW_SANDBOX,
  buildPreviewDocument,
  codeArtifactByteLength,
  type HtmlArtifactCandidate,
} from "./code-artifact.js";
import "./code-artifact.css";

export interface CodeArtifactView {
  readonly sourceTurnId: string;
  readonly source: string;
  readonly modelSource: string;
  readonly dirty: boolean;
}

export const CREATE_CANVAS_PROMPT =
  "Create a complete self-contained HTML document for the requested idea. " +
  "Use inline CSS and JavaScript only, with Canvas when useful. " +
  "Do not use external libraries, URLs, fonts, images, fetch or network calls. " +
  "Return the complete runnable document in one fenced ```html code block so A008 can open it in Canvas.";

export function CodeArtifactPanel(props: {
  readonly artifact?: CodeArtifactView;
  readonly pending?: HtmlArtifactCandidate;
  readonly onSourceChange: (source: string) => void;
  readonly onUseModelUpdate: () => void;
  readonly onRevert: () => void;
  readonly onClose: () => void;
  readonly onPrompt: (prompt: string) => void;
}) {
  const [tab, setTab] = useState<"code" | "preview">("preview");
  const preview = useMemo(() => {
    if (!props.artifact) return { document: "", error: "" };
    try { return { document: buildPreviewDocument(props.artifact.source), error: "" }; }
    catch (error) {
      return {
        document: "",
        error: error instanceof Error ? error.message : "Code preview is unavailable.",
      };
    }
  }, [props.artifact?.source]);

  return (
    <section className="a008-code-canvas" aria-label="Code Canvas">
      <header className="a008-code-canvas-header">
        <div>
          <p className="a008-code-canvas-kicker">Session artifact</p>
          <h2>Code Canvas</h2>
        </div>
        <button type="button" className="a008-code-canvas-close" onClick={props.onClose} aria-label="Close Code Canvas">×</button>
      </header>

      {props.artifact ? (
        <>
          <div className="a008-code-canvas-meta">
            <span>HTML · {codeArtifactByteLength(props.artifact.source).toLocaleString()} bytes</span>
            <span>{props.artifact.dirty ? "Local edits" : "Model version"}</span>
          </div>
          {props.pending ? (
            <div className="a008-code-canvas-update" role="status">
              <span>A008 produced a newer HTML version while local edits are present.</span>
              <button type="button" onClick={props.onUseModelUpdate}>Use model update</button>
            </div>
          ) : null}
          <div className="a008-code-canvas-tabs" role="tablist" aria-label="Code Canvas view">
            <button type="button" role="tab" aria-selected={tab === "code"} onClick={() => setTab("code")}>Code</button>
            <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>Preview</button>
          </div>
          {tab === "code" ? (
            <div className="a008-code-canvas-code-pane">
              <textarea
                aria-label="HTML artifact source"
                spellCheck={false}
                value={props.artifact.source}
                onChange={(event) => props.onSourceChange(event.currentTarget.value)}
              />
              <button type="button" className="a008-code-canvas-revert" disabled={!props.artifact.dirty} onClick={props.onRevert}>Revert local edits</button>
            </div>
          ) : (
            <div className="a008-code-canvas-preview-pane">
              {preview.error ? (
                <p className="a008-code-canvas-preview-error" role="alert">{preview.error}</p>
              ) : (
                <iframe
                  title="A008 isolated code preview"
                  sandbox={CODE_PREVIEW_SANDBOX}
                  referrerPolicy="no-referrer"
                  srcDoc={preview.document}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="a008-code-canvas-empty">
          <p>Open a complete HTML code block from chat to preview it here.</p>
          <button type="button" onClick={() => props.onPrompt(CREATE_CANVAS_PROMPT)}>Ask A008 for a canvas</button>
          <p className="a008-code-canvas-note">Artifacts stay in this browser session. Saving to the repository still uses the normal approved file tools.</p>
        </div>
      )}
    </section>
  );
}
