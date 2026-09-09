export const MAX_CODE_ARTIFACT_BYTES = 256 * 1024;

export type AnswerSegment =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "code";
      readonly language: string;
      readonly code: string;
      readonly artifactEligible: boolean;
      readonly oversized: boolean;
    };

export interface HtmlArtifactCandidate {
  readonly sourceTurnId: string;
  readonly language: "html";
  readonly source: string;
  readonly bytes: number;
}

const HTML_LANGUAGES = new Set(["html", "htm"]);
const FENCE = /```([^\r\n`]*)\r?\n([\s\S]*?)```/gu;

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function normalizeLanguage(info: string): string {
  return info.trim().split(/\s+/u, 1)[0]?.toLowerCase() ?? "";
}

export function parseAssistantAnswer(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let offset = 0;
  FENCE.lastIndex = 0;
  for (let match = FENCE.exec(answer); match !== null; match = FENCE.exec(answer)) {
    if (match.index > offset) {
      segments.push({ kind: "text", text: answer.slice(offset, match.index) });
    }
    const language = normalizeLanguage(match[1] ?? "");
    const code = match[2] ?? "";
    const bytes = utf8Bytes(code);
    segments.push({
      kind: "code",
      language,
      code,
      artifactEligible: HTML_LANGUAGES.has(language) && bytes <= MAX_CODE_ARTIFACT_BYTES,
      oversized: bytes > MAX_CODE_ARTIFACT_BYTES,
    });
    offset = match.index + match[0].length;
  }
  if (offset < answer.length) {
    segments.push({ kind: "text", text: answer.slice(offset) });
  }
  if (segments.length === 0 && answer !== "") {
    return [{ kind: "text", text: answer }];
  }
  return segments;
}

export function htmlArtifactFromAnswer(
  answer: string,
  sourceTurnId: string,
): HtmlArtifactCandidate | undefined {
  const html = parseAssistantAnswer(answer)
    .filter((segment): segment is Extract<AnswerSegment, { kind: "code" }> =>
      segment.kind === "code" && segment.artifactEligible,
    )
    .at(-1);
  if (html === undefined) return undefined;
  return {
    sourceTurnId,
    language: "html",
    source: html.code,
    bytes: utf8Bytes(html.code),
  };
}

const PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "worker-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "navigate-to 'none'",
].join("; ");

const PREVIEW_GUARD = `<script>(()=>{
  const blocked=()=>{throw new Error("A008 preview network access is disabled.");};
  for(const name of ["fetch","WebSocket","EventSource","XMLHttpRequest"]){
    try{Object.defineProperty(window,name,{value:blocked,writable:false,configurable:false});}catch{}
  }
  try{Object.defineProperty(window,"open",{value:blocked,writable:false,configurable:false});}catch{}
  try{Object.defineProperty(navigator,"sendBeacon",{value:blocked,writable:false,configurable:false});}catch{}
})();</script>`;

export function buildPreviewDocument(source: string): string {
  const bytes = utf8Bytes(source);
  if (bytes > MAX_CODE_ARTIFACT_BYTES) {
    throw new Error("Code artifact exceeds the preview size limit.");
  }
  const withoutDoctype = source.replace(/^\s*<!doctype[^>]*>\s*/iu, "");
  const policy = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  const charset = `<meta charset="utf-8">`;
  return `${policy}${charset}${PREVIEW_GUARD}${withoutDoctype}`;
}

export const CODE_PREVIEW_SANDBOX = "allow-scripts";
export const codeArtifactByteLength = utf8Bytes;
