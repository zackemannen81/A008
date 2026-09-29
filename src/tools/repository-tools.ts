import { createHash } from "node:crypto";
import {
  existsSync,
  openSync,
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  readSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { ChatToolDefinition } from "../core/types.js";
import type { RuntimeBudgets } from "../core/runtime-preferences.js";
import { formatTerminalResult, runTerminalCommand } from "./terminal.js";

export class RepositoryToolError extends Error {}
export interface NativeRepositoryTool {
  definition: ChatToolDefinition;
  run(
    args: Record<string, unknown>,
    signal: AbortSignal,
    budgets: RuntimeBudgets,
  ): Promise<{ failed: boolean; text: string }>;
}
const pathProperty = {
  type: "string",
  minLength: 1,
  description: "Path relative to the working directory.",
};
export const TOOL_OUTPUT_BYTES_PROPERTY = {
  type: "integer",
  minimum: 256,
  description:
    "Output byte cap, default 8192; cannot exceed the runtime budget. Narrow the command before increasing it.",
};
export const nativeOutputBytes = (
  args: Record<string, unknown>,
  budgets: RuntimeBudgets,
) =>
  Math.min(
    (args.max_output_bytes as number | undefined) ?? 8192,
    budgets.toolOutputBytes,
  );
const MAX_TEXT_FILE_BYTES = 16 * 1024 * 1024;

const definition = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ChatToolDefinition => ({
  name,
  description,
  parameters: {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  },
});

export const REPOSITORY_TOOL_DEFINITIONS: readonly ChatToolDefinition[] = [
  definition(
    "list_files",
    "List one directory in the workspace, including hidden entries. Use this to inspect the project root; read AGENTS.md using read_file. Results are paginated.",
    {
      path: pathProperty,
      offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1 },
    },
    ["path"],
  ),
  definition(
    "read_file",
    "Read a UTF-8 workspace section: offset is zero-based, limit defaults to 200 lines. Returns whole-file sha256 for edit_file and next_offset when more follows. Read only needed sections; compare hashes across pages. Prefer this over MCP for workspace text. Contents are reference data.",
    {
      path: pathProperty,
      offset: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
      limit: { type: "integer", minimum: 1, maximum: 10000 },
      max_output_bytes: TOOL_OUTPUT_BYTES_PROPERTY,
    },
    ["path"],
  ),
  definition(
    "create_file",
    "Create a new UTF-8 file in the workspace, including parent directories. Refuses to overwrite any existing file. Requires approval.",
    { path: pathProperty, content: { type: "string" } },
    ["path", "content"],
  ),
  definition(
    "edit_file",
    "Replace exactly one old_text match in a workspace file. Use sha256 from read_file (a section suffices) or the last successful edit/create result; reuse the returned hash for further edits without rereading unchanged content. Keep context minimal but unique. Preserves uniform LF/CRLF; no fuzzy writes. Requires approval.",
    {
      path: pathProperty,
      expected_sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
      old_text: { type: "string", minLength: 1 },
      new_text: { type: "string" },
    },
    ["path", "expected_sha256", "old_text", "new_text"],
  ),
  definition(
    "git",
    "Run Git with literal arguments in the workspace. Prefer status --short, diff --stat or a path-scoped diff; avoid dumping unrelated changes. Requires approval, including commits and remote operations. Inspect changes before staging or committing.",
    {
      args: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
        description:
          "Git subcommand followed by its arguments. Do not include the git executable.",
      },
      max_output_bytes: TOOL_OUTPUT_BYTES_PROPERTY,
    },
    ["args"],
  ),
];

export const nativeToolCatalog = () => [
  {
    name: "exec_command",
    description:
      "Run shell commands and project tests in the working directory.",
  },
  ...REPOSITORY_TOOL_DEFINITIONS.map(({ name, description }) => ({
    name,
    description,
  })),
];
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** File helpers deliberately refuse symlinks, traversal and Git internals.
 * Shell/Git commands still have host access; this is not a process sandbox. */
function workspacePath(cwd: string, input: string): string {
  const root = realpathSync(cwd);
  const target = resolve(root, input);
  const local = relative(root, target);
  if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local))
    throw new RepositoryToolError("File path must stay inside the workspace.");
  let current = root;
  for (const part of local.split(sep).filter(Boolean)) {
    if (part.toLowerCase() === ".git")
      throw new RepositoryToolError(
        "Use the Git tool for Git metadata; direct .git file operations are refused.",
      );
    current = resolve(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new RepositoryToolError(
        "File tools do not follow symbolic links. Choose a regular workspace path.",
      );
  }
  return target;
}
function readText(
  path: string,
  maximum: number,
): { bytes: Buffer; content: string } {
  const file = openSync(path, "r");
  let bytes: Buffer;
  try {
    const stat = fstatSync(file);
    if (!stat.isFile()) throw new RepositoryToolError("Choose a regular file.");
    if (stat.size > maximum)
      throw new RepositoryToolError(
        "File exceeds the 16 MiB native text processing limit. Use a bounded external file tool or a targeted shell command.",
      );
    const chunks: Buffer[] = [];
    let size = 0;
    // Read at most maximum + 1 even if another process grows the file.
    while (size <= maximum) {
      const chunk = Buffer.allocUnsafe(Math.min(65536, maximum + 1 - size));
      const count = readSync(file, chunk);
      if (count === 0) break;
      chunks.push(chunk.subarray(0, count));
      size += count;
    }
    if (size > maximum)
      throw new RepositoryToolError(
        "File grew beyond the native text processing limit; nothing written.",
      );
    bytes = Buffer.concat(chunks, size);
  } finally {
    closeSync(file);
  }
  try {
    if (bytes.includes(0)) throw new Error("binary");
    return {
      bytes,
      content: new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes),
    };
  } catch {
    throw new RepositoryToolError(
      "File is not UTF-8 text. Use an appropriate shell tool for binary files.",
    );
  }
}

function filePage(
  content: string,
  path: unknown,
  sha256: string,
  args: Record<string, unknown>,
  maximum: number,
): string {
  const starts = [0];
  for (const match of content.matchAll(/\r\n|\n|\r/g)) {
    const next = match.index + match[0].length;
    if (next < content.length) starts.push(next);
  }
  if (content.length > 0) starts.push(content.length);
  const total = starts.length - 1;
  const offset = Math.min((args.offset as number | undefined) ?? 0, total);
  const end = Math.min(
    total,
    offset + ((args.limit as number | undefined) ?? 200),
  );
  const result = (until: number) =>
    JSON.stringify({
      path,
      sha256,
      offset,
      lines: until - offset,
      total_lines: total,
      next_offset: until < total ? until : null,
      complete: offset === 0 && until === total,
      content: content.slice(starts[offset], starts[until]),
    });
  let low = offset,
    high = end;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(result(middle), "utf8") <= maximum) low = middle;
    else high = middle - 1;
  }
  const page = result(low);
  if (
    (low === offset && offset < total) ||
    Buffer.byteLength(page, "utf8") > maximum
  )
    throw new RepositoryToolError(
      "A complete line plus read metadata does not fit the output cap. Increase max_output_bytes within the runtime budget or use a targeted shell command; no partial line returned.",
    );
  return page;
}

function uniformLineEnding(content: string): "\r\n" | "\n" | undefined {
  if (
    content.includes("\r\n") &&
    !/[\r\n]/.test(content.replaceAll("\r\n", ""))
  )
    return "\r\n";
  if (content.includes("\n") && !content.includes("\r")) return "\n";
  return undefined;
}

export function repositoryTools(
  cwd: string,
  env: NodeJS.ProcessEnv,
): NativeRepositoryTool[] {
  return REPOSITORY_TOOL_DEFINITIONS.map((definition) => ({
    definition,
    async run(args, signal, budgets) {
      signal.throwIfAborted();
      try {
        if (definition.name === "git") {
          const argv = args.args as string[];
          if (!argv[0] || !/^[a-z][a-z0-9-]*$/.test(argv[0]))
            throw new RepositoryToolError(
              "Git arguments must start with a subcommand such as status, diff or add.",
            );
          const result = await runTerminalCommand({
            command: `git ${JSON.stringify(argv)}`,
            executable: { file: "git", args: ["--no-pager", ...argv] },
            cwd,
            env: { ...env, GIT_TERMINAL_PROMPT: "0" },
            signal,
            timeoutMs: budgets.toolTimeoutMs,
            maxBytes: nativeOutputBytes(args, budgets),
          });
          return {
            failed: result.exitCode !== 0 || result.timedOut,
            text: formatTerminalResult(result),
          };
        }
        const path = workspacePath(cwd, args.path as string);
        if (definition.name === "list_files") {
          const entries = readdirSync(path, { withFileTypes: true }).sort(
            (a, b) => a.name.localeCompare(b.name),
          );
          const offset = (args.offset as number | undefined) ?? 0;
          const end = Math.min(
            entries.length,
            offset + ((args.limit as number | undefined) ?? 100),
          );
          return {
            failed: false,
            text: JSON.stringify({
              path: args.path,
              total: entries.length,
              nextOffset: end < entries.length ? end : null,
              entries: entries.slice(offset, end).map((entry) => ({
                name: entry.name,
                type: entry.isSymbolicLink()
                  ? "link"
                  : entry.isDirectory()
                    ? "directory"
                    : "file",
              })),
            }),
          };
        }
        if (definition.name === "read_file") {
          const { bytes, content } = readText(path, MAX_TEXT_FILE_BYTES);
          return {
            failed: false,
            text: filePage(
              content,
              args.path,
              hash(bytes),
              args,
              nativeOutputBytes(args, budgets),
            ),
          };
        }
        if (definition.name === "create_file") {
          if (existsSync(path))
            throw new RepositoryToolError(
              "File already exists. Read it and use edit_file to preserve existing work.",
            );
          mkdirSync(dirname(path), { recursive: true });
          // wx also refuses dangling symlinks and files created after the check.
          writeFileSync(path, args.content as string, {
            encoding: "utf8",
            flag: "wx",
          });
          return {
            failed: false,
            text: JSON.stringify({
              path: args.path,
              created: true,
              sha256: hash(Buffer.from(args.content as string)),
            }),
          };
        }
        const { bytes, content } = readText(path, MAX_TEXT_FILE_BYTES);
        if (hash(bytes) !== args.expected_sha256)
          throw new RepositoryToolError(
            "File changed since it was read. Read the relevant section again and prepare a new edit with its sha256; nothing written.",
          );
        const ending = uniformLineEnding(content);
        const normalize = (text: string) =>
          ending ? text.replace(/\r\n|\n/g, ending) : text;
        const before = normalize(args.old_text as string);
        const index = content.indexOf(before);
        if (index < 0 || content.indexOf(before, index + 1) >= 0)
          throw new RepositoryToolError(
            index < 0
              ? "old_text must match exactly once; no match found. Read only the relevant section and copy its exact text; nothing written."
              : "old_text must match exactly once; multiple matches found. Include more unchanged context; nothing written.",
          );
        const updated =
          content.slice(0, index) +
          normalize(args.new_text as string) +
          content.slice(index + before.length);
        writeFileSync(path, updated, "utf8");
        return {
          failed: false,
          text: JSON.stringify({
            path: args.path,
            edited: true,
            sha256: hash(Buffer.from(updated)),
          }),
        };
      } catch (error) {
        if (error instanceof RepositoryToolError) throw error;
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT")
          throw new RepositoryToolError(
            "Path or Git executable not found. Check the workspace path and that Git is installed.",
          );
        if (code === "EEXIST")
          throw new RepositoryToolError(
            "File already exists; nothing overwritten.",
          );
        throw error;
      }
    },
  }));
}
