import { ASCII_LOGO } from "./a008-ascii.js";

const ART = ASCII_LOGO.replace(/^\n/u, "").replace(/\n$/u, "");

/** Decorative empty-chat mark. Hidden from the accessibility tree. */
export function AsciiLogo() {
  return (
    <div className="a008-empty-logo-wrap">
      <pre className="a008-empty-logo" aria-hidden="true">
        {ART}
      </pre>
    </div>
  );
}
