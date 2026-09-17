#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { ModelToolSession } from "./tools/model-tools.js";
import { pathToFileURL } from "node:url";
import { parseSlash, SLASH_HELP } from "./cli/slash.js";
import { ChatError, isChatError } from "./core/errors.js";
import { isIdentityError } from "./identity/errors.js";
import { isMemoryError } from "./memory/errors.js";
import {
  DEFAULT_MODEL_ID,
  defaultModelRegistry,
  type ModelRegistry,
} from "./core/model-registry.js";
import type { ChatTransport } from "./core/types.js";
import type { NvidiaChatTransportOptions } from "./providers/nvidia/nvidia-chat-transport.js";
import {
  createLocalMemoryRuntime,
  type LocalMemoryRuntime,
  type LocalMemorySession,
} from "./runtime/local-memory-runtime.js";
import {
  formatTerminalResult,
  runTerminalCommand,
  type TerminalRunner,
} from "./tools/terminal.js";

export interface CliDependencies {
  readonly env: NodeJS.ProcessEnv;
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
  readonly registry: ModelRegistry;
  readonly cwd: string;
  readonly runTerminal: TerminalRunner;
  readonly createTransport?: (
    options: NvidiaChatTransportOptions,
  ) => ChatTransport;
}

interface ChatCommandOptions {
  readonly model: string;
  readonly systemMessage?: string;
  readonly debugTrace?: string;
  readonly debugTraceFile?: string;
}

const HELP = `A008 - provider-neutral AI chat CLI

Usage:
  A008 models
  A008 chat [--model <model-id>] [--system <message>] [--debug-trace off|safe|raw] [--debug-trace-file <absolute-path>]
  A008 --help

Environment:
  NVIDIA_API_KEY              Required for NVIDIA chat (or set KIE_API_KEY).
  KIE_API_KEY                 Optional kie.ai key for chat and image jobs.
  NVIDIA_CHAT_COMPLETIONS_URL Optional trusted endpoint override.
  A008_PROJECT_ID             Optional stable project runtime ID.
  A008_AGENT_ID               Optional stable agent runtime ID.
  A008_MEMORY_SQLITE_PATH     SQLite path outside the repository. Defaults to ~/.A008/memory.sqlite.
  A008_DEBUG_TRACE            off (default), safe, or raw.
  A008_DEBUG_TRACE_FILE       Absolute JSONL path required for raw traces and for ACP traces.

${SLASH_HELP}
Raw debug traces write local prompts, projected memory, reasoning, answers, and
semantic JSON. They never include API keys or authorization headers. Delete the
SQLite file and JSONL trace to reset local state. Terminal access is native
\`/shell\`; A008 does not install LangChain or Stagehand.
`;

function dependencies(overrides: Partial<CliDependencies>): CliDependencies {
  return {
    env: process.env,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    registry: defaultModelRegistry,
    cwd: process.cwd(),
    runTerminal: runTerminalCommand,
    ...overrides,
  };
}

function preview(text: string, max = 200): string {
  const compact = text.replace(/\s+/gu, " ").trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, max - 3)}...`;
}

async function handleSlash(
  input: string,
  ctx: {
    readonly deps: CliDependencies;
    readonly runtime: LocalMemoryRuntime;
    systemMessage: string | undefined;
    session: LocalMemorySession;
  },
): Promise<"quit" | "continue" | "unhandled"> {
  let parsed;
  try {
    parsed = parseSlash(input);
  } catch (error) {
    writeError(ctx.deps.stderr, error);
    return "continue";
  }
  if (parsed === undefined) {
    return "unhandled";
  }

  const out = ctx.deps.stdout;
  switch (parsed.name) {
    case "help":
      out.write(SLASH_HELP);
      return "continue";
    case "exit":
      return "quit";
    case "reset":
      ctx.session.reset();
      out.write("Session reset.\n");
      return "continue";
    case "undo":
      out.write(
        ctx.session.undoLastTurn()
          ? "Last turn undone.\n"
          : "Nothing to undo.\n",
      );
      return "continue";
    case "history": {
      const turns = ctx.session.messages.filter(
        (message) => message.role !== "system",
      );
      if (turns.length === 0) {
        out.write("No conversation turns.\n");
        return "continue";
      }
      for (const message of turns) {
        out.write(`${message.role}: ${preview(message.content)}\n`);
      }
      return "continue";
    }
    case "model": {
      if (parsed.argument.length === 0) {
        out.write(`Current: ${ctx.session.model}\n`);
        for (const profile of ctx.deps.registry.list()) {
          out.write(`${profile.id}\t${profile.name}\n`);
        }
        return "continue";
      }
      const profile = ctx.deps.registry.require(parsed.argument);
      ctx.session = ctx.runtime.openSession({
        model: profile.id,
        ...(ctx.systemMessage === undefined
          ? {}
          : { systemMessage: ctx.systemMessage }),
      });
      out.write(
        `Model: ${profile.name} (${profile.id}). Conversation reset.\n`,
      );
      return "continue";
    }
    case "status":
      out.write(`model: ${ctx.session.model}\n`);
      out.write(`cwd: ${ctx.deps.cwd}\n`);
      out.write(`project: ${ctx.runtime.projectId}\n`);
      out.write(`memory: ${ctx.runtime.sqlitePath}\n`);
      out.write(
        `turns: ${ctx.session.messages.filter((m) => m.role !== "system").length}\n`,
      );
      out.write(
        "tools: exec_command, list_files, read_file, create_file, edit_file, git (model-invoked, approval per action); /shell (user-initiated)\n",
      );
      return "continue";
    case "cwd":
      out.write(`${ctx.deps.cwd}\n`);
      return "continue";
    case "tools":
      out.write(
        "terminal  /shell <command>  native A008 runner in cwd\n" +
          "          /! <command>      alias\n" +
          "exec_command  model-invoked shell; requires approval for each action (ADR 0028).\n" +
          "list_files/read_file/create_file/edit_file  workspace files, approved and revision-guarded.\n" +
          "git  literal Git arguments in cwd; approval per action.\n",
      );
      return "continue";
    case "shell": {
      if (parsed.argument.length === 0) {
        writeError(
          ctx.deps.stderr,
          new ChatError("configuration", "Usage: /shell <command>"),
        );
        return "continue";
      }
      out.write(`shell> ${parsed.argument}\n`);
      const result = await ctx.deps.runTerminal({
        command: parsed.argument,
        cwd: ctx.deps.cwd,
      });
      out.write(formatTerminalResult(result));
      return "continue";
    }
    default:
      return "continue";
  }
}

function parseChatOptions(args: readonly string[]): ChatCommandOptions {
  let model = DEFAULT_MODEL_ID;
  let systemMessage: string | undefined;
  let debugTrace: string | undefined;
  let debugTraceFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (argument === "--model" && value !== undefined) {
      model = value;
      index += 1;
      continue;
    }
    if (argument === "--system" && value !== undefined) {
      systemMessage = value;
      index += 1;
      continue;
    }
    if (argument === "--debug-trace" && value !== undefined) {
      debugTrace = value;
      index += 1;
      continue;
    }
    if (argument === "--debug-trace-file" && value !== undefined) {
      debugTraceFile = value;
      index += 1;
      continue;
    }

    throw new ChatError(
      "configuration",
      `Unknown or incomplete chat option: ${argument ?? ""}`,
    );
  }

  return {
    model,
    ...(systemMessage === undefined ? {} : { systemMessage }),
    ...(debugTrace === undefined ? {} : { debugTrace }),
    ...(debugTraceFile === undefined ? {} : { debugTraceFile }),
  };
}

function writeError(stderr: NodeJS.WritableStream, error: unknown): void {
  const message =
    isChatError(error) || isMemoryError(error) || isIdentityError(error)
      ? `${error.code}: ${error.message}`
      : "unexpected: Chat command failed unexpectedly.";
  stderr.write(`Error: ${message}\n`);
}

async function runChat(
  args: readonly string[],
  deps: CliDependencies,
): Promise<number> {
  const options = parseChatOptions(args);
  const profile = deps.registry.require(options.model);
  const runtime = createLocalMemoryRuntime({
    env: deps.env,
    surface: "cli",
    registry: deps.registry,
    stderr: deps.stderr,
    cli: {
      ...(options.debugTrace === undefined
        ? {}
        : { debugTrace: options.debugTrace }),
      ...(options.debugTraceFile === undefined
        ? {}
        : { debugTraceFile: options.debugTraceFile }),
    },
    ...(deps.createTransport === undefined
      ? {}
      : { createTransport: deps.createTransport }),
  });
  const ctx = {
    deps,
    runtime,
    systemMessage: options.systemMessage,
    session: runtime.openSession({
      model: profile.id,
      ...(options.systemMessage === undefined
        ? {}
        : { systemMessage: options.systemMessage }),
    }),
  };
  const terminal = createInterface({
    input: deps.stdin,
    output: deps.stdout,
    terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });

  deps.stdout.write(`Model: ${profile.name} (${profile.id})\n`);
  deps.stdout.write(
    "Type /help for commands, /shell for a local terminal, /exit to quit.\n",
  );
  const modelTools = new ModelToolSession({ cwd: deps.cwd, env: deps.env });
  let activeController: AbortController | undefined;
  const interrupt = () => {
    if (activeController) activeController.abort();
    else terminal.close();
  };
  terminal.on("SIGINT", interrupt);
  process.on("SIGINT", interrupt);

  try {
    while (true) {
      let input: string;
      try {
        input = await terminal.question("you> ");
      } catch {
        break;
      }

      const command = input.trim();
      if (command.length === 0) {
        continue;
      }
      const slash = await handleSlash(command, ctx);
      if (slash === "quit") {
        break;
      }
      if (slash === "continue") {
        continue;
      }

      let contentStarted = false;
      let reasoningStarted = false;
      deps.stdout.write("assistant> ");

      try {
        const controller = new AbortController();
        activeController = controller;
        const result = await ctx.session.turn(command, {
          signal: controller.signal,
          prepareTools: (signal, budgets) =>
            modelTools.prepare(
              budgets,
              {
                approve: async (activity, approvalSignal) => {
                  deps.stdout.write(
                    `\nTool: ${activity.name}\ncwd: ${activity.cwd}\n${activity.input}\n`,
                  );
                  try {
                    return (
                      (
                        await terminal.question(
                          "Allow this action once? [y/N] ",
                          { signal: approvalSignal },
                        )
                      )
                        .trim()
                        .toLowerCase() === "y"
                    );
                  } catch {
                    return false;
                  }
                },
                update: async (activity) => {
                  if (activity.status !== "pending")
                    deps.stderr.write(
                      `tool> ${activity.name}: ${activity.status}${activity.output ? `\n${activity.output}` : ""}\n`,
                    );
                },
              },
              signal,
            ),
          onDelta: (delta) => {
            if (delta.type === "reasoning") {
              if (!reasoningStarted) {
                deps.stderr.write("reasoning> ");
                reasoningStarted = true;
              }
              deps.stderr.write(delta.text);
              return;
            }
            contentStarted = true;
            deps.stdout.write(delta.text);
          },
        });

        if (!contentStarted) {
          deps.stdout.write(result.completion.message.content);
        }
        if (reasoningStarted) {
          deps.stderr.write("\n");
        }
        deps.stdout.write("\n");
        if (result.memoryDiagnostic !== undefined) {
          deps.stderr.write(`memory> ${result.memoryDiagnostic}\n`);
        }
      } catch (error) {
        deps.stdout.write("\n");
        writeError(deps.stderr, error);
      } finally {
        activeController = undefined;
      }
    }
  } finally {
    process.off("SIGINT", interrupt);
    terminal.close();
    await modelTools.close();
    runtime.close();
  }

  return 0;
}

export async function runCli(
  args: readonly string[],
  overrides: Partial<CliDependencies> = {},
): Promise<number> {
  const deps = dependencies(overrides);
  const [command = "help", ...rest] = args;

  try {
    if (command === "help" || command === "--help" || command === "-h") {
      deps.stdout.write(HELP);
      return 0;
    }

    if (command === "models") {
      for (const profile of deps.registry.list()) {
        deps.stdout.write(`${profile.id}\t${profile.name}\n`);
      }
      return 0;
    }

    if (command === "chat") {
      return await runChat(rest, deps);
    }

    deps.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
    return 2;
  } catch (error) {
    writeError(deps.stderr, error);
    return 2;
  }
}

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(entryPath).href
) {
  process.exitCode = await runCli(process.argv.slice(2));
}
