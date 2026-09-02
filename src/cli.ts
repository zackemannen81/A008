#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
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
import { createLocalMemoryRuntime } from "./runtime/local-memory-runtime.js";
import { DEFAULT_SYSTEM_MESSAGE } from "./runtime/nvidia-session.js";

export interface CliDependencies {
  readonly env: NodeJS.ProcessEnv;
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
  readonly registry: ModelRegistry;
  readonly createTransport?: (
    options: NvidiaChatTransportOptions,
  ) => ChatTransport;
}

interface ChatCommandOptions {
  readonly model: string;
  readonly systemMessage: string;
  readonly debugTrace?: string;
  readonly debugTraceFile?: string;
}

const HELP = `A008 - provider-neutral AI chat CLI

Usage:
  A008 models
  A008 chat [--model <model-id>] [--system <message>] [--debug-trace off|safe|raw] [--debug-trace-file <absolute-path>]
  A008 --help

Environment:
  NVIDIA_API_KEY              Required only for the chat command.
  NVIDIA_CHAT_COMPLETIONS_URL Optional trusted endpoint override.
  A008_PROJECT_ID             Optional stable project runtime ID.
  A008_AGENT_ID               Optional stable agent runtime ID.
  A008_MEMORY_SQLITE_PATH     SQLite path outside the repository. Defaults to ~/.A008/memory.sqlite.
  A008_DEBUG_TRACE            off (default), safe, or raw.
  A008_DEBUG_TRACE_FILE       Absolute JSONL path required for raw traces and for ACP traces.

Interactive commands:
  /exit            End the session.
  /reset           Keep the system message and clear conversation turns.

Raw debug traces write local prompts, projected memory, reasoning, answers, and
semantic JSON. They never include API keys or authorization headers. Delete the
SQLite file and JSONL trace to reset local state.
`;

function dependencies(overrides: Partial<CliDependencies>): CliDependencies {
  return {
    env: process.env,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    registry: defaultModelRegistry,
    ...overrides,
  };
}

function parseChatOptions(args: readonly string[]): ChatCommandOptions {
  let model = DEFAULT_MODEL_ID;
  let systemMessage = DEFAULT_SYSTEM_MESSAGE;
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
    systemMessage,
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
  const session = runtime.openSession({
    model: profile.id,
    systemMessage: options.systemMessage,
  });
  const terminal = createInterface({
    input: deps.stdin,
    output: deps.stdout,
    terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });

  deps.stdout.write(`Model: ${profile.name} (${profile.id})\n`);
  deps.stdout.write("Type /exit to quit or /reset to clear conversation turns.\n");

  try {
    while (true) {
      let input: string;
      try {
        input = await terminal.question("you> ");
      } catch {
        break;
      }

      const command = input.trim();
      if (command === "/exit") {
        break;
      }
      if (command === "/reset") {
        session.reset();
        deps.stdout.write("Session reset.\n");
        continue;
      }
      if (command.length === 0) {
        continue;
      }

      let contentStarted = false;
      let reasoningStarted = false;
      deps.stdout.write("assistant> ");

      try {
        const result = await session.turn(command, {
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
      }
    }
  } finally {
    terminal.close();
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
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
