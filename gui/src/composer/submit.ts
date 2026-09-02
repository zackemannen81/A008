import type { GuiSession } from "../session/types.js";
import {
  ComposerSlashError,
  parseSlash,
  SLASH_HELP,
  type SlashName,
} from "./slash.js";

export interface ComposerSubmitDeps {
  readonly session: GuiSession;
  readonly runShellCommand: (command: string) => Promise<string>;
}

export type ComposerSubmitResult =
  | { readonly kind: "empty" }
  | { readonly kind: "prompt"; readonly text: string }
  | { readonly kind: "notice"; readonly command: SlashName; readonly message: string }
  | { readonly kind: "error"; readonly message: string };

export async function submitComposer(
  input: string,
  deps: ComposerSubmitDeps,
): Promise<ComposerSubmitResult> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { kind: "empty" };
  }

  let parsed;
  try {
    parsed = parseSlash(trimmed);
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof ComposerSlashError
          ? error.message
          : `Unknown command: ${trimmed}. Type /help.`,
    };
  }

  if (parsed === undefined) {
    await deps.session.prompt(trimmed);
    return { kind: "prompt", text: trimmed };
  }

  switch (parsed.name) {
    case "help":
      return { kind: "notice", command: "help", message: SLASH_HELP };
    case "exit":
      await deps.session.cancel();
      return {
        kind: "notice",
        command: "exit",
        message: "In-flight work cancelled. The GUI stays open.",
      };
    case "reset": {
      if (await callOptional(deps.session, "reset")) {
        return { kind: "notice", command: "reset", message: "Session reset." };
      }
      return {
        kind: "notice",
        command: "reset",
        message: "Session reset is not on this session client.",
      };
    }
    case "undo": {
      const undo = Reflect.get(deps.session, "undoLastTurn");
      if (typeof undo === "function") {
        const undone = await undo.call(deps.session);
        return {
          kind: "notice",
          command: "undo",
          message: undone ? "Last turn undone." : "Nothing to undo.",
        };
      }
      return {
        kind: "notice",
        command: "undo",
        message: "Undo is not on this session client.",
      };
    }
    case "history":
      return {
        kind: "notice",
        command: "history",
        message: formatHistory(deps.session),
      };
    case "model":
      return {
        kind: "notice",
        command: "model",
        message: formatModel(deps.session, parsed.argument),
      };
    case "status":
      return {
        kind: "notice",
        command: "status",
        message: formatStatus(deps.session),
      };
    case "cwd":
      return {
        kind: "notice",
        command: "cwd",
        message: "/shell uses the GUI host process working directory.",
      };
    case "tools":
      return {
        kind: "notice",
        command: "tools",
        message:
          "terminal  /shell <command>  native A008 runner in GUI host cwd\n" +
          "          /! <command>      alias\n" +
          "Model-invoked tool_calls are not on ChatTransport (ADR 0003).\n" +
          "@langchain/community is not a dependency.\n",
      };
    case "shell":
      return runShell(parsed.argument, deps);
    default: {
      const _exhaustive: never = parsed.name;
      return {
        kind: "error",
        message: `Unknown command: /${_exhaustive}. Type /help.`,
      };
    }
  }
}

async function runShell(
  argument: string,
  deps: ComposerSubmitDeps,
): Promise<ComposerSubmitResult> {
  if (argument.length === 0) {
    return { kind: "error", message: "Usage: /shell <command>" };
  }

  const shell = Reflect.get(deps.session, "shell");
  const output =
    typeof shell === "function"
      ? await shell.call(deps.session, argument)
      : await deps.runShellCommand(argument);
  const text = typeof output === "string" ? output : "";
  return {
    kind: "notice",
    command: "shell",
    message: text.length > 0 ? text : `shell> ${argument}`,
  };
}

async function callOptional(
  session: GuiSession,
  name: string,
): Promise<boolean> {
  const method = Reflect.get(session, name);
  if (typeof method !== "function") {
    return false;
  }
  await method.call(session);
  return true;
}

function formatHistory(session: GuiSession): string {
  const thought = session.thought.trim();
  const answer = session.answer.trim();
  if (thought.length === 0 && answer.length === 0) {
    return "No conversation turns.";
  }
  const lines: string[] = [];
  if (thought.length > 0) {
    lines.push(`thought: ${thought}`);
  }
  if (answer.length > 0) {
    lines.push(`answer: ${answer}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatModel(session: GuiSession, argument: string): string {
  const current = `Current: ${session.model}`;
  if (argument.length === 0) {
    return `${current}\n`;
  }
  return `${current}\nModel switching is not on this session client.\n`;
}

function formatStatus(session: GuiSession): string {
  return (
    `model: ${session.model}\n` +
    `status: ${session.status}\n` +
    `session: ${session.sessionId ?? "(none)"}\n` +
    `error: ${session.error ?? "(none)"}\n` +
    "tools: terminal via /shell (user-initiated; not LangChain)\n"
  );
}
