import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";

export const EDIT_FAILURE_OUTPUT_BYTES = 4_096;
const RECOVERY_SECTION_BYTES = 1_200;
const RECOVERY_DIFF_BYTES = 1_000;
const MAX_DIAGNOSTIC_LINES = 50_000;
const MIN_CLOSEST_SIMILARITY = 0.7;

export interface EditRecoverySection {
  readonly offset: number;
  readonly lines: number;
  readonly content: string;
}

export interface EditClosestMatch {
  readonly similarity: number;
  readonly content: string;
  readonly diff: string;
  readonly section: EditRecoverySection;
}

export interface EditFailure {
  readonly code:
    | "stale_base"
    | "ambiguous_match"
    | "no_exact_match"
    | "stale_during_edit"
    | "validation_failed"
    | "adoption_failed";
  readonly retryable: boolean;
  readonly written: false;
  readonly message: string;
  readonly expectedSha256?: string;
  readonly currentSha256?: string;
  readonly actualOccurrences?: number;
  readonly currentSection?: EditRecoverySection;
  readonly matches?: readonly EditRecoverySection[];
  readonly closestMatch?: EditClosestMatch;
}

export interface TextEditPlan {
  readonly updated: string;
  readonly sha256: string;
}

export type TextEditPlanResult =
  | { readonly ok: true; readonly plan: TextEditPlan }
  | { readonly ok: false; readonly failure: EditFailure };

interface LineSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const hashBytes = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

export const hashText = (value: string) =>
  hashBytes(Buffer.from(value, "utf8"));

function boundedText(value: string, maximum: number): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= maximum) return value;
  const decoder = new TextDecoder();
  return decoder.decode(bytes.subarray(0, maximum), { stream: true });
}

function lineSpans(content: string): LineSpan[] {
  if (content.length === 0) return [{ start: 0, end: 0, text: "" }];
  const spans: LineSpan[] = [];
  let start = 0;
  for (const match of content.matchAll(/\r\n|\n|\r/g)) {
    spans.push({
      start,
      end: match.index,
      text: content.slice(start, match.index),
    });
    start = match.index + match[0].length;
  }
  spans.push({ start, end: content.length, text: content.slice(start) });
  return spans;
}

function lineIndexAtOffset(lines: readonly LineSpan[], offset: number): number {
  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (lines[middle]!.start <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}

function recoverySection(
  content: string,
  offset: number,
  contextLines = 2,
): EditRecoverySection {
  const lines = lineSpans(content);
  const center = lineIndexAtOffset(lines, Math.max(0, offset));
  const start = Math.max(0, center - contextLines);
  const end = Math.min(lines.length, center + contextLines + 1);
  const first = lines[start]!;
  const last = lines[end - 1]!;
  return {
    offset: start,
    lines: end - start,
    content: boundedText(
      content.slice(first.start, last.end),
      RECOVERY_SECTION_BYTES,
    ),
  };
}

function countOccurrences(
  content: string,
  needle: string,
): { count: number; offsets: number[] } {
  let count = 0;
  let from = 0;
  const offsets: number[] = [];
  while (from <= content.length) {
    const index = content.indexOf(needle, from);
    if (index < 0) break;
    count += 1;
    if (offsets.length < 3) offsets.push(index);
    from = index + Math.max(1, needle.length);
  }
  return { count, offsets };
}

function uniformLineEnding(content: string): "\r\n" | "\n" | "\r" | undefined {
  const crlf = content.match(/\r\n/g)?.length ?? 0;
  const withoutCrlf = content.replaceAll("\r\n", "");
  const lf = withoutCrlf.match(/\n/g)?.length ?? 0;
  const cr = withoutCrlf.match(/\r/g)?.length ?? 0;
  if (crlf > 0 && lf === 0 && cr === 0) return "\r\n";
  if (lf > 0 && crlf === 0 && cr === 0) return "\n";
  if (cr > 0 && crlf === 0 && lf === 0) return "\r";
  return undefined;
}

function normalizeLineEndings(
  value: string,
  ending: "\r\n" | "\n" | "\r" | undefined,
): string {
  return ending ? value.replace(/\r\n|\n|\r/g, ending) : value;
}

function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let index = 0; index < a.length - 1; index += 1) {
    const gram = a.slice(index, index + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  let intersection = 0;
  for (let index = 0; index < b.length - 1; index += 1) {
    const gram = b.slice(index, index + 2);
    const available = counts.get(gram) ?? 0;
    if (available <= 0) continue;
    intersection += 1;
    if (available === 1) counts.delete(gram);
    else counts.set(gram, available - 1);
  }
  return (2 * intersection) / (a.length + b.length - 2);
}

function compactDiff(expected: string, actual: string): string {
  let prefix = 0;
  const minimum = Math.min(expected.length, actual.length);
  while (prefix < minimum && expected[prefix] === actual[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < minimum - prefix &&
    expected[expected.length - 1 - suffix] ===
      actual[actual.length - 1 - suffix]
  )
    suffix += 1;
  const before = expected.slice(
    Math.max(0, prefix - 80),
    expected.length - suffix,
  );
  const after = actual.slice(Math.max(0, prefix - 80), actual.length - suffix);
  return boundedText(
    `expected: ${before}\nactual:   ${after}`,
    RECOVERY_DIFF_BYTES,
  );
}

function closestMatch(
  content: string,
  expected: string,
): EditClosestMatch | undefined {
  const lines = lineSpans(content);
  if (lines.length > MAX_DIAGNOSTIC_LINES) return undefined;
  const normalizedExpected = expected.replace(/\r\n|\r/g, "\n");
  const expectedLines = normalizedExpected.split("\n");
  const expectedLineCount = Math.max(1, expectedLines.length);
  const anchorIndex = expectedLines.reduce(
    (best, line, index, all) =>
      line.trim().length > all[best]!.trim().length ? index : best,
    0,
  );
  const anchor = expectedLines[anchorIndex]!.trim();
  const candidates = new Set<number>();

  if (anchor.length >= 4) {
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index]!.text.includes(anchor))
        candidates.add(Math.max(0, index - anchorIndex));
      if (candidates.size >= 24) break;
    }
  }

  if (candidates.size === 0 && anchor.length > 0) {
    const ranked: { index: number; similarity: number }[] = [];
    const compare = anchor.slice(0, 512);
    for (let index = 0; index < lines.length; index += 1) {
      const similarity = bigramSimilarity(
        compare,
        lines[index]!.text.slice(0, 512),
      );
      if (similarity < 0.35) continue;
      ranked.push({ index, similarity });
    }
    ranked
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8)
      .forEach(({ index }) => candidates.add(Math.max(0, index - anchorIndex)));
  }

  let best:
    | {
        startLine: number;
        start: number;
        end: number;
        value: string;
        similarity: number;
      }
    | undefined;
  for (const startLine of candidates) {
    const endLine = Math.min(lines.length, startLine + expectedLineCount);
    if (endLine <= startLine) continue;
    const start = lines[startLine]!.start;
    const end = lines[endLine - 1]!.end;
    const value = content.slice(start, end);
    const similarity = bigramSimilarity(
      normalizedExpected,
      value.replace(/\r\n|\r/g, "\n"),
    );
    if (!best || similarity > best.similarity)
      best = { startLine, start, end, value, similarity };
  }

  if (!best || best.similarity < MIN_CLOSEST_SIMILARITY) return undefined;
  return {
    similarity: Math.round(best.similarity * 1000) / 1000,
    content: boundedText(best.value, RECOVERY_SECTION_BYTES),
    diff: compactDiff(expected, best.value),
    section: recoverySection(content, best.start),
  };
}

function recoveryForCurrentText(
  content: string,
  oldText: string,
): {
  currentSection?: EditRecoverySection;
  closestMatch?: EditClosestMatch;
} {
  const ending = uniformLineEnding(content);
  const normalized = normalizeLineEndings(oldText, ending);
  const exact = content.indexOf(normalized);
  if (exact >= 0) return { currentSection: recoverySection(content, exact) };
  const closest = closestMatch(content, normalized);
  return closest
    ? { currentSection: closest.section, closestMatch: closest }
    : {};
}

export function planTextEdit(input: {
  content: string;
  currentSha256: string;
  expectedSha256: string;
  oldText: string;
  newText: string;
}): TextEditPlanResult {
  if (input.currentSha256 !== input.expectedSha256) {
    return {
      ok: false,
      failure: {
        code: "stale_base",
        retryable: true,
        written: false,
        message:
          "File changed after this edit was prepared. Rebase against the supplied current revision; nothing written.",
        expectedSha256: input.expectedSha256,
        currentSha256: input.currentSha256,
        ...recoveryForCurrentText(input.content, input.oldText),
      },
    };
  }

  const ending = uniformLineEnding(input.content);
  const before = normalizeLineEndings(input.oldText, ending);
  const replacement = normalizeLineEndings(input.newText, ending);
  const matches = countOccurrences(input.content, before);
  if (matches.count !== 1) {
    if (matches.count > 1) {
      return {
        ok: false,
        failure: {
          code: "ambiguous_match",
          retryable: true,
          written: false,
          message:
            "old_text matches more than once. Add unchanged surrounding context and retry; nothing written.",
          currentSha256: input.currentSha256,
          actualOccurrences: matches.count,
          matches: matches.offsets.map((offset) =>
            recoverySection(input.content, offset, 1),
          ),
        },
      };
    }
    const closest = closestMatch(input.content, before);
    return {
      ok: false,
      failure: {
        code: "no_exact_match",
        retryable: true,
        written: false,
        message: closest
          ? "Exact old_text was not found. Use the supplied closest current text to prepare an exact retry; nothing written."
          : "Exact old_text was not found. Read only the relevant section and retry with exact current text; nothing written.",
        currentSha256: input.currentSha256,
        ...(closest ? { closestMatch: closest } : {}),
      },
    };
  }

  const index = matches.offsets[0]!;
  const updated =
    input.content.slice(0, index) +
    replacement +
    input.content.slice(index + before.length);
  return {
    ok: true,
    plan: { updated, sha256: hashText(updated) },
  };
}

const locks = new Map<string, Promise<void>>();

export async function withFileEditLock<T>(
  path: string,
  action: () => Promise<T> | T,
): Promise<T> {
  const previous = locks.get(path) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  locks.set(path, tail);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (locks.get(path) === tail) locks.delete(path);
  }
}

function writeCandidate(path: string, bytes: Buffer, mode: number): void {
  const handle = openSync(path, "wx", mode);
  try {
    let offset = 0;
    while (offset < bytes.length)
      offset += writeSync(handle, bytes, offset, bytes.length - offset);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
}

function removeIfPresent(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // Best effort cleanup only; the original target remains authoritative.
  }
}

export function atomicAdoptText(input: {
  path: string;
  originalBytes: Buffer;
  candidateText: string;
  adopt?: (candidatePath: string, targetPath: string) => void;
}):
  | { ok: true; sha256: string; atomic: true }
  | { ok: false; failure: EditFailure } {
  const candidateBytes = Buffer.from(input.candidateText, "utf8");
  const originalSha256 = hashBytes(input.originalBytes);
  const candidateSha256 = hashBytes(candidateBytes);
  const mode = statSync(input.path).mode;
  const candidatePath = join(
    dirname(input.path),
    `.a008-edit-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    writeCandidate(candidatePath, candidateBytes, mode);
    const staged = readFileSync(candidatePath);
    if (hashBytes(staged) !== candidateSha256) {
      return {
        ok: false,
        failure: {
          code: "validation_failed",
          retryable: true,
          written: false,
          message:
            "Candidate file failed validation; original file was not replaced.",
        },
      };
    }

    const current = readFileSync(input.path);
    const currentSha256 = hashBytes(current);
    if (currentSha256 !== originalSha256) {
      return {
        ok: false,
        failure: {
          code: "stale_during_edit",
          retryable: true,
          written: false,
          message:
            "File changed while the candidate edit was being prepared; original target was not replaced.",
          expectedSha256: originalSha256,
          currentSha256,
        },
      };
    }

    try {
      (input.adopt ?? renameSync)(candidatePath, input.path);
    } catch {
      return {
        ok: false,
        failure: {
          code: "adoption_failed",
          retryable: true,
          written: false,
          message:
            "Atomic candidate adoption failed; the original target remains unchanged.",
        },
      };
    }

    const adopted = readFileSync(input.path);
    if (hashBytes(adopted) !== candidateSha256) {
      const rollbackPath = join(
        dirname(input.path),
        `.a008-rollback-${process.pid}-${randomUUID()}.tmp`,
      );
      try {
        writeCandidate(rollbackPath, input.originalBytes, mode);
        renameSync(rollbackPath, input.path);
      } finally {
        removeIfPresent(rollbackPath);
      }
      return {
        ok: false,
        failure: {
          code: "validation_failed",
          retryable: true,
          written: false,
          message:
            "Post-adoption validation failed and the original file was restored.",
          currentSha256: originalSha256,
        },
      };
    }
    return { ok: true, sha256: candidateSha256, atomic: true };
  } finally {
    removeIfPresent(candidatePath);
  }
}
