import { useEffect, useState } from "react";
import { ASCII_LOGO } from "./a008-ascii.js";

const ART = ASCII_LOGO.replace(/^\n/u, "").replace(/\n$/u, "");

/** Decorative empty-chat mark. Supports theme-based logo switching. */
export function AsciiLogo() {
  const [isCyberpunk, setIsCyberpunk] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const checkTheme = () => {
      setIsCyberpunk(root.getAttribute("data-a008-theme") === "cyberpunk");
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-a008-theme"] });
    return () => observer.disconnect();
  }, []);

  if (isCyberpunk) {
    return (
      <div className="a008-empty-logo-wrap">
        <img
          className="a008-cyberpunk-logo"
          src="/logo_cyberpunk.png"
          alt="Cyberpunk Logo"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div className="a008-empty-logo-wrap">
      <pre className="a008-empty-logo" aria-hidden="true">
        {ART}
      </pre>
    </div>
  );
}