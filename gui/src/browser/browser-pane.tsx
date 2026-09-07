import { useState, type FormEvent } from "react";
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

export function BrowserPane() {
  const [draft, setDraft] = useState(DEFAULT_URL);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [error, setError] = useState<string>();

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
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <iframe
        title="Workbench browser"
        src={url}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
      />
      <p className="a008-browser-note">
        Pages that refuse to be framed stay blank. This pane does not grant the
        model browser tools.
      </p>
    </section>
  );
}

export { normalizeUrl };
