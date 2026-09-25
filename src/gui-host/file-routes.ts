import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { ChatError } from "../core/errors.js";

const MAX_FILE_BYTES = 256 * 1024;

export interface WorkspaceFileEntry {
  readonly name: string;
  readonly path: string;
  readonly type: "directory" | "file";
}

export interface WorkspaceTextFile {
  readonly path: string;
  readonly content: string;
  readonly sha256: string;
}

function fileError(message: string): never {
  throw new ChatError("configuration", message, { status: 400 });
}

function resolveWorkspacePath(cwd: string, input: string): string {
  if (typeof input !== "string" || input.length === 0 || isAbsolute(input)) fileError("File path must be a non-empty workspace-relative path.");
  const root = realpathSync(cwd);
  const target = resolve(root, input);
  const local = relative(root, target);
  if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) fileError("File path must stay inside the workspace.");
  let current = root;
  for (const part of local.split(sep).filter(Boolean)) {
    if (part.toLowerCase() === ".git") fileError("Direct .git access is refused.");
    current = resolve(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) fileError("File browser does not follow symbolic links.");
  }
  return target;
}

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readText(path: string): { readonly bytes: Buffer; readonly content: string } {
  if (!statSync(path).isFile()) fileError("Choose a regular file.");
  if (statSync(path).size > MAX_FILE_BYTES) fileError("File exceeds the 256 KiB editor limit.");
  const bytes = readFileSync(path);
  try {
    if (bytes.includes(0)) throw new Error("binary");
    return { bytes, content: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) };
  } catch {
    fileError("File is not UTF-8 text.");
  }
}

export function listWorkspaceFiles(cwd: string, directory: string): readonly WorkspaceFileEntry[] {
  const path = resolveWorkspacePath(cwd, directory);
  if (!statSync(path).isDirectory()) fileError("Choose a directory.");
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => !entry.isSymbolicLink() && entry.name.toLowerCase() !== ".git")
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({ name: entry.name, path: `${directory}/${entry.name}`.replaceAll("\\", "/"), type: entry.isDirectory() ? "directory" : "file" }));
}

export function readWorkspaceTextFile(cwd: string, input: string): WorkspaceTextFile {
  const path = resolveWorkspacePath(cwd, input);
  const { bytes, content } = readText(path);
  return { path: input, content, sha256: hash(bytes) };
}

export function writeWorkspaceTextFile(cwd: string, input: string, expectedSha256: string, content: string): WorkspaceTextFile {
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256)) fileError("expectedSha256 must be a SHA-256 digest.");
  if (typeof content !== "string") fileError("File content must be text.");
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) fileError("File exceeds the 256 KiB editor limit.");
  const path = resolveWorkspacePath(cwd, input);
  const current = readText(path);
  if (hash(current.bytes) !== expectedSha256) fileError("File changed since it was opened. Reload before saving; nothing was written.");
  writeFileSync(path, content, "utf8");
  return { path: input, content, sha256: hash(Buffer.from(content, "utf8")) };
}
