import { ChatError } from "../core/errors.js";

export const SLASH_HELP = `Interactive commands:
  /help              Show this list.
  /exit, /quit, /q   End the session.
  /reset, /clear     Keep the system message and clear conversation turns.
  /undo              Drop the last user and assistant turn.
  /history           Show committed turns (no system message).
  /model             Show the current model and the registry.
  /model <id>        Switch model (starts a new conversation).
  /status            Model, cwd, project, memory path, tools.
  /cwd               Show the working directory for /shell.
  /tools             List CLI tools. Terminal is user-initiated /shell.
  /shell <command>   Run a local shell command in cwd (native A008 tool).
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

const EXIT_NAMES = new Set(["exit", "quit", "q"]);
const RESET_NAMES = new Set(["reset", "clear"]);

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
    throw new ChatError(
      "configuration",
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
  if (raw === "undo" || raw === "history" || raw === "model" || raw === "status" || raw === "cwd" || raw === "tools" || raw === "shell") {
    return { name: raw, argument };
  }

  throw new ChatError(
    "configuration",
    `Unknown command: /${raw}. Type /help.`,
  );
}
