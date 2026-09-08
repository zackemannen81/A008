import { useEffect, useState, type FormEvent } from "react";
import { checkFrame } from "./frame-check.js";
import "./browser.css";

const DEFAULT_URL = "https://docs.nvidia.com/";

function normalizeUrl(input: string): string | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/iu.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function BrowserBlocked(props: {
  readonly url: string;
  readonly reason?: string;
}) {
  const policy = props.reason === "x-frame-options" ? "X-Frame-Options" : "frame-ancestors";
  return (
    <div className="a008-browser-blocked" role="status">
      <p>
        <strong>{hostOf(props.url)}</strong> does not allow embedding in this
        pane ({policy}).
      </p>
      <p>A008 cannot override that. Open the page in your system browser instead.</p>
      <a href={props.url} target="_blank" rel="noopener noreferrer">
        Open in browser
      </a>
    </div>
  );
}

export function BrowserViewport(props: {
  readonly url: string;
  readonly mode: "checking" | "framed" | "blocked";
  readonly reason?: string;
}) {
  if (props.mode === "blocked") {
    return <BrowserBlocked url={props.url} reason={props.reason} />;
  }
  if (props.mode === "checking") {
    return <p className="a008-browser-note">Checking whether this page can be framed…</p>;
  }
  return (
    <iframe
      title="Workbench browser"
      src={props.url}
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
    />
  );
}

export function BrowserPane() {
  const [draft, setDraft] = useState(DEFAULT_URL);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [mode, setMode] = useState<"checking" | "framed" | "blocked">("checking");
  const [reason, setReason] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const target = url;
    let cancelled = false;
    setMode("checking");
    setReason(undefined);
    void checkFrame(target)
      .then((result) => {
        if (cancelled) return;
        if (result.embeddable) {
          setMode("framed");
        } else {
          setMode("blocked");
          setReason(result.reason);
        }
      })
      .catch(() => {
        if (!cancelled) setMode("framed");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function go(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const next = normalizeUrl(draft);
    if (next === undefined) {
      setError("Enter an http(s) URL.");
      return;
    }
    setError(undefined);
    setUrl(next);
    setDraft(next);
  }

  return (
    <section className="a008-browser" aria-label="Browser">
      <form className="a008-browser-bar" onSubmit={go}>
        <label>
          <span className="a008-sr-only">Address</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            inputMode="url"
          />
        </label>
        <button type="submit">Go</button>
        <a
          className="a008-browser-open"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </a>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <BrowserViewport url={url} mode={mode} reason={reason} />
      <p className="a008-browser-note">
        Sites such as ChatGPT and NVIDIA Build forbid iframes. This pane does
        not grant the model browser tools.
      </p>
    </section>
  );
}

export { normalizeUrl };
