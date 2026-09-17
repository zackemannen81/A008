/**
 * Content-addressed blob store for `POST /v1/upload` (ADR 0020 D2, D3).
 *
 * The host never interprets bytes; it only sniffs a media type from the
 * magic bytes (imported from `../ingest/media-type.js`, not the barrel
 * `../ingest/index.js` — that file also loads the extractor registry and the
 * NVIDIA image describer, and ADR 0020 D1 says this process must not gain a
 * runtime it does not need), writes the original to disk, and mints a stable
 * `source:<sha256>/<sanitised-name>` locator for the ACP process to resolve.
 *
 * The declared filename is advisory (ADR 0020 "Filename handling"): it never
 * decides the media type and never reaches the filesystem unsanitised.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { ChatError } from "../core/errors.js";

export const SOURCE_STORE_PATH_ENV = "A008_SOURCE_STORE_PATH";

/** Stable name used when a declared filename sanitises to nothing. */
export const UPLOAD_PLACEHOLDER_FILENAME = "upload";

/**
 * Keeps `<storeRoot>/<sha256>/<name>` well under Windows' ~260 character path
 * limit even for a nested store root; not a protocol requirement.
 */
const MAX_UPLOAD_FILENAME_LENGTH = 150;

const CONTROL_CHARACTER_MAX = 0x1f;
const DEL_CHARACTER = 0x7f;
const PATH_SEPARATORS = /[\\/]/gu;
const ONLY_DOTS = /^\.+$/u;
// Windows treats these as reserved device names regardless of extension
// ("con.txt" is as invalid as "con"); a locator segment must never collide
// with one, so it is deliberately not "sanitised to nothing" but disarmed.
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/iu;

/**
 * Removes every ASCII control character, including NUL, by code point rather
 * than by a regex character class — a charclass spanning control code points
 * is easy to mistranscribe into literal bytes, and a literal NUL or ESC byte
 * sitting in this source file is exactly the kind of thing that should not
 * exist just to describe itself.
 */
function stripControlCharacters(value: string): string {
  let out = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= CONTROL_CHARACTER_MAX || codePoint === DEL_CHARACTER) {
      continue;
    }
    out += character;
  }
  return out;
}

/**
 * Turns a declared, untrusted filename into one that is safe to use as a
 * single path segment: no path separators, no `..`, no control characters or
 * NUL, and no collision with a Windows reserved device name. A name that
 * sanitises to nothing gets a stable placeholder rather than a random one, so
 * the same bad input always produces the same locator.
 */
export function sanitiseUploadFilename(declared: string | undefined): string {
  const trimmed = (declared ?? "").trim();
  if (trimmed.length === 0) {
    return UPLOAD_PLACEHOLDER_FILENAME;
  }
  let name = stripControlCharacters(trimmed).replace(PATH_SEPARATORS, "");
  while (name.includes("..")) {
    name = name.split("..").join("");
  }
  name = name.trim();
  if (name.length === 0 || ONLY_DOTS.test(name)) {
    return UPLOAD_PLACEHOLDER_FILENAME;
  }
  if (WINDOWS_RESERVED_NAME.test(name)) {
    name = `_${name}`;
  }
  return name.length > MAX_UPLOAD_FILENAME_LENGTH
    ? name.slice(0, MAX_UPLOAD_FILENAME_LENGTH)
    : name;
}

/** `source:<sha256>/<sanitised-name>`, per ADR 0020 D2. */
export function sourceLocator(sha256: string, filename: string): string {
  return `source:${sha256}/${filename}`;
}

/**
 * Resolves the on-disk path for one blob and refuses any result that would
 * land outside `storeRoot`. `sha256` and `filename` are expected to already
 * be safe (a hex digest and a sanitised name), but this check runs regardless
 * — path containment is a security boundary, not a convenience check
 * (ADR 0020 D2), so it must hold even if an upstream sanitiser has a bug.
 */
export function blobPath(
  storeRoot: string,
  sha256: string,
  filename: string,
): string {
  const resolvedRoot = resolve(storeRoot);
  const candidate = resolve(resolvedRoot, sha256, filename);
  const rel = relative(resolvedRoot, candidate);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new ChatError(
      "configuration",
      "Upload locator would escape the configured source store.",
    );
  }
  return candidate;
}

export interface StoredBlob {
  readonly locator: string;
  readonly path: string;
}

/**
 * Writes `bytes` to the content-addressed path for `sha256`/`filename`,
 * creating the per-hash directory as needed. A path that already holds a
 * file is left alone: the path is derived from the SHA-256 of the bytes, so
 * an existing file at that exact path is already the same content, and the
 * same upload seen twice yields one stored blob and one locator rather than
 * a duplicate write.
 */
export function writeBlob(
  storeRoot: string,
  sha256: string,
  filename: string,
  bytes: Uint8Array,
): StoredBlob {
  const path = blobPath(storeRoot, sha256, filename);
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) {
    writeFileSync(path, bytes);
  }
  return { locator: sourceLocator(sha256, filename), path };
}

/**
 * Resolves the configured store root exactly as `A008_MEMORY_SQLITE_PATH` is
 * resolved in `src/runtime/local-runtime-config.ts` (ADR 0020 D2): made
 * absolute, then rejected when it lands inside the A008 repository. The
 * logic is intentionally self-contained rather than imported — `src/runtime/`
 * is a sibling task's write scope during this wave, and this host only needs
 * the validation shape, not a shared implementation.
 *
 * Returns `undefined` when nothing is configured, so a host that never
 * serves an upload does not have to set the variable.
 */
export function resolveSourceStorePath(
  explicit: string | undefined,
  cwd: string,
  env: NodeJS.ProcessEnv,
): string | undefined {
  const configured = explicit ?? env[SOURCE_STORE_PATH_ENV]?.trim();
  if (configured === undefined || configured.length === 0) {
    return undefined;
  }
  const resolved = isAbsolute(configured)
    ? resolve(configured)
    : resolve(cwd, configured);
  const repositoryRoot = findRepositoryRootFrom(cwd);
  if (repositoryRoot !== undefined) {
    const relativeToRepo = relative(repositoryRoot, resolved);
    const insideRepo =
      relativeToRepo === "" ||
      (!relativeToRepo.startsWith("..") && !isAbsolute(relativeToRepo));
    if (insideRepo) {
      throw new ChatError(
        "configuration",
        `${SOURCE_STORE_PATH_ENV} must be outside the A008 repository.`,
      );
    }
  }
  return resolved;
}

function findRepositoryRootFrom(startDirectory: string): string | undefined {
  let current = resolve(startDirectory);
  while (true) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "AGENTS.md"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}
