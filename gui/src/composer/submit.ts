import type { GuiSession, PromptImageAttachment } from "../session/types.js";
import {
  loadModels,
  type SessionControl,
  type SessionSnapshot,
} from "../session/session-controls.js";
import {
  ComposerSlashError,
  parseSlash,
  SLASH_HELP,
  type SlashName,
} from "./slash.js";

export interface ComposerSubmitDeps {
  readonly session: GuiSession;
  readonly runShellCommand: (command: string) => Promise<string>;
  readonly attachment?: PromptImageAttachment;
  readonly models?: typeof loadModels;
}
export type ComposerSubmitResult =
  | { readonly kind: "empty" }
  | { readonly kind: "prompt"; readonly text: string }
  | {
      readonly kind: "notice";
      readonly command: SlashName;
      readonly message: string;
    }
  | { readonly kind: "error"; readonly message: string };

export const GUI_TOOLS =
  "terminal  /shell <command>  native A008 runner\n          /! <command>      alias\nModel tools are listed under Tools → Repository after connecting. Approve model actions in this GUI.\nUpload stores sources; Memory inspects the shared store.";

export async function controlSession(
  session: GuiSession,
  control: SessionControl,
): Promise<SessionSnapshot> {
  if (session.controlSession === undefined)
    throw new Error(
      "Session controls require the current A008 client and host.",
    );
  return session.controlSession(control);
}
export function formatHistory(state: SessionSnapshot): string {
  return state.messages.length === 0
    ? "No conversation turns."
    : state.messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
}
export function formatStatus(
  session: GuiSession,
  state: SessionSnapshot,
): string {
  return `model: ${state.model}\nstatus: ${session.status}\nsession: ${session.sessionId ?? "(none)"}\ncwd: ${state.runtime.cwd}\nproject: ${state.runtime.projectId ?? "(unavailable)"}\nmemory: ${state.runtime.memoryPath ?? "(unavailable)"}\ntools: terminal via /shell, source upload, memory inspection`;
}
export async function submitComposer(
  input: string,
  deps: ComposerSubmitDeps,
): Promise<ComposerSubmitResult> {
  const text = input.trim();
  if (text.length === 0) return { kind: "empty" };
  let parsed;
  try {
    parsed = parseSlash(text);
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof ComposerSlashError
          ? error.message
          : "Invalid command. Type /help.",
    };
  }
  if (parsed === undefined) {
    await deps.session.prompt(text, deps.attachment);
    return { kind: "prompt", text };
  }
  const notice = (message: string): ComposerSubmitResult => ({
    kind: "notice",
    command: parsed.name,
    message,
  });
  switch (parsed.name) {
    case "help":
      return notice(SLASH_HELP);
    case "exit":
      if (deps.session.endSession === undefined)
        throw new Error("End session requires the current A008 client.");
      await deps.session.endSession();
      return notice("Session ended. Connect to start a new conversation.");
    case "reset":
      await controlSession(deps.session, { action: "reset" });
      return notice(
        "Conversation cleared. System message, model and parameters retained. Saved memory remains.",
      );
    case "undo": {
      const state = await controlSession(deps.session, { action: "undo" });
      return notice(
        state.undone
          ? "Last committed turn undone. Saved memory remains."
          : "Nothing to undo.",
      );
    }
    case "history":
      return notice(
        formatHistory(
          await controlSession(deps.session, { action: "inspect" }),
        ),
      );
    case "model": {
      if (parsed.argument !== "") {
        const state = await controlSession(deps.session, {
          action: "model",
          model: parsed.argument,
        });
        return notice(
          `Model: ${state.model}\nNew conversation started with this model's runtime defaults.`,
        );
      }
      const models = await (deps.models ?? loadModels)();
      return notice(
        `Current: ${deps.session.model}\n\n${models.map((m) => `${m.id}  ${m.name}`).join("\n")}\n\n/model <id> starts a new conversation.`,
      );
    }
    case "status":
      return notice(
        formatStatus(
          deps.session,
          await controlSession(deps.session, { action: "inspect" }),
        ),
      );
    case "cwd":
      return notice(
        (await controlSession(deps.session, { action: "inspect" })).runtime.cwd,
      );
    case "tools":
      return notice(`${GUI_TOOLS}${deps.session.details?.runtime.tools ? `\n\n${deps.session.details.runtime.tools.map(tool => `${tool.name}  ${tool.description}`).join("\n")}` : ""}`);
    case "shell":
      if (parsed.argument === "")
        return { kind: "error", message: "Usage: /shell <command>" };
      return notice(await deps.runShellCommand(parsed.argument));
  }
}
