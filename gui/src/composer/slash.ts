export const SLASH_HELP = `Composer commands:
  /help              Show this list.
  /exit, /quit, /q   Cancel in-flight work. The GUI stays open.
  /reset, /clear     Keep the session and clear conversation turns if supported.
  /undo              Drop the last user and assistant turn if supported.
  /history           Show current thought and answer buffers.
  /model             Show the current model.
  /model <id>        Model switching is owned by the session client.
  /status            Model, session, connection, tools.
  /cwd               Show the working directory used by /shell.
  /tools             List GUI tools. Terminal is user-initiated /shell.
  /shell <command>   Run a local shell command in the GUI host cwd.
  /! <command>       Alias for /shell.

Unknown /commands are not sent to the model. There is no LangChain tool host.
`;

export type SlashName =
  | "help"
  | "exit"
  | "reset"
  | "undo"
  | "history"
  | "model"
  | "status"
  | "cwd"
  | "tools"
  | "shell";

export interface ParsedSlash {
  readonly name: SlashName;
  readonly argument: string;
}

export class ComposerSlashError extends Error {
  readonly code = "configuration" as const;

  constructor(message: string) {
    super(message);
    this.name = "ComposerSlashError";
  }
}

const EXIT_NAMES = new Set(["exit", "quit", "q"]);
const RESET_NAMES = new Set(["reset", "clear"]);
const PASSTHROUGH_NAMES = new Set<SlashName>([
  "undo",
  "history",
  "model",
  "status",
  "cwd",
  "tools",
  "shell",
]);

export function parseSlash(input: string): ParsedSlash | undefined {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return undefined;
  }

  if (trimmed.startsWith("/!")) {
    return { name: "shell", argument: trimmed.slice(2).trim() };
  }

  const match = /^\/([A-Za-z][\w-]*)(?:\s+([\s\S]*))?$/u.exec(trimmed);
  if (match === null) {
    throw new ComposerSlashError(
      `Unknown command: ${trimmed}. Type /help.`,
    );
  }
  const raw = match[1]!.toLowerCase();
  const argument = (match[2] ?? "").trim();

  if (raw === "help") {
    return { name: "help", argument };
  }
  if (EXIT_NAMES.has(raw)) {
    return { name: "exit", argument };
  }
  if (RESET_NAMES.has(raw)) {
    return { name: "reset", argument };
  }
  if (PASSTHROUGH_NAMES.has(raw as SlashName)) {
    return { name: raw as SlashName, argument };
  }

  throw new ComposerSlashError(`Unknown command: /${raw}. Type /help.`);
}
