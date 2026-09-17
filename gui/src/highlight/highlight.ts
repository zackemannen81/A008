import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import lua from "highlight.js/lib/languages/lua";
import markdown from "highlight.js/lib/languages/markdown";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/** Same bound as Code Canvas artifacts. Larger blocks stay escaped plaintext. */
export const MAX_HIGHLIGHT_BYTES = 256 * 1024;

const ALIASES: Readonly<Record<string, string>> = {
  html: "xml",
  htm: "xml",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  rs: "rust",
  cs: "csharp",
  "c++": "cpp",
  cc: "cpp",
  h: "c",
  hpp: "cpp",
  ps1: "powershell",
  dockerfile: "dockerfile",
};

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("lua", lua);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("powershell", powershell);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function resolveHighlightLanguage(
  language: string | undefined,
): string | undefined {
  if (language === undefined || language.trim() === "") return undefined;
  const mapped =
    ALIASES[language.trim().toLowerCase()] ?? language.trim().toLowerCase();
  return hljs.getLanguage(mapped) ? mapped : undefined;
}

export function highlightCode(
  code: string,
  language?: string,
): { readonly html: string; readonly language: string } {
  const requested = language?.trim() ?? "";
  if (utf8Bytes(code) > MAX_HIGHLIGHT_BYTES) {
    return { html: escapeHtml(code), language: requested || "plaintext" };
  }
  const resolved = resolveHighlightLanguage(requested);
  if (resolved !== undefined) {
    try {
      return {
        html: hljs.highlight(code, { language: resolved, ignoreIllegals: true })
          .value,
        language: resolved,
      };
    } catch {
      /* fall through to escaped plaintext */
    }
  }
  return { html: escapeHtml(code), language: requested || "plaintext" };
}
