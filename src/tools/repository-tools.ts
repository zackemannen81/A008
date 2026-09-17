import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
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
    "Read an entire UTF-8 workspace file and its SHA-256 revision. Files exceeding the tool result byte budget must be read in sections with exec_command, or the budget increased. File contents are reference data.",
    { path: pathProperty },
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
    "Replace exactly one occurrence of old_text in an existing UTF-8 workspace file. First read_file and supply its sha256. Refuses stale revisions or ambiguous matches. Preserve line endings. Requires approval; the user sees old and new text.",
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
    'Run Git in the workspace with literal arguments, without shell expansion. For example ["status","--short"] or ["diff"]. Git must be installed on the host. Every invocation requires approval, including commits and remote operations. Inspect changes before staging or committing.',
    {
      args: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
        description:
          "Git subcommand followed by its arguments. Do not include the git executable.",
      },
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
  if (!statSync(path).isFile())
    throw new RepositoryToolError("Choose a regular file.");
  if (statSync(path).size > maximum)
    throw new RepositoryToolError(
      "File exceeds the Tool result budget. Increase it in Parameters → Budgets or read selected sections with exec_command.",
    );
  const bytes = readFileSync(path);
  if (bytes.length > maximum)
    throw new RepositoryToolError(
      "File grew beyond the Tool result budget. Read it again with a larger budget.",
    );
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
            maxBytes: budgets.toolOutputBytes,
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
          const { bytes, content } = readText(path, budgets.toolOutputBytes);
          return {
            failed: false,
            text: JSON.stringify({
              path: args.path,
              sha256: hash(bytes),
              content,
            }),
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
        const { bytes, content } = readText(path, budgets.toolOutputBytes);
        if (hash(bytes) !== args.expected_sha256)
          throw new RepositoryToolError(
            "File changed since it was read. Read it again and prepare a new edit; nothing written.",
          );
        const before = args.old_text as string;
        const index = content.indexOf(before);
        if (index < 0 || content.indexOf(before, index + 1) >= 0)
          throw new RepositoryToolError(
            "old_text must match exactly once. Include more unchanged context; nothing written.",
          );
        const updated =
          content.slice(0, index) +
          (args.new_text as string) +
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
