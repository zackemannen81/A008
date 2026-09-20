import { createHash } from "node:crypto";
import type { McpServer } from "@agentclientprotocol/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type {
  JsonSchemaType,
  JsonSchemaValidator,
} from "@modelcontextprotocol/sdk/validation/types.js";
import type {
  ChatToolCall,
  ChatToolDefinition,
  ChatTools,
} from "../core/types.js";
import type { RuntimeBudgets } from "../core/runtime-preferences.js";
import {
  runTerminalCommand,
  formatTerminalResult,
  killProcessTree,
} from "./terminal.js";
import { repositoryTools, RepositoryToolError } from "./repository-tools.js";

export interface ToolActivity {
  readonly id: string;
  readonly name: string;
  readonly input: string;
  readonly cwd: string;
  readonly status: "pending" | "in_progress" | "completed" | "failed";
  readonly output?: string;
}
export interface ToolApproval {
  approve(activity: ToolActivity, signal: AbortSignal): Promise<boolean>;
  update(activity: ToolActivity): Promise<void>;
}
interface RegisteredTool {
  definition: ChatToolDefinition;
  validate: JsonSchemaValidator<Record<string, unknown>>;
  run(
    args: Record<string, unknown>,
    signal: AbortSignal,
    budgets: RuntimeBudgets,
  ): Promise<{ failed: boolean; text: string }>;
}

export function toolEnvironment(
  env: NodeJS.ProcessEnv,
): Record<string, string> {
  // Provider secrets and process injection options never enter shell children.
  const safe = new Set([
    "PATH",
    "PATHEXT",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOME",
    "LANG",
    "LC_ALL",
    "APPDATA",
    "LOCALAPPDATA",
  ]);
  return Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] =>
        safe.has(entry[0].toUpperCase()) && typeof entry[1] === "string",
    ),
  );
}

export function boundedToolText(
  text: string,
  maximum: number,
): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text);
  if (bytes.length <= maximum) return { text, truncated: false };
  // TextDecoder drops an incomplete UTF-8 tail; no replacement bytes exceed the limit.
  const decoder = new TextDecoder();
  return {
    text: decoder.decode(bytes.subarray(0, maximum), { stream: true }),
    truncated: true,
  };
}

/** One session's native tool and explicitly supplied, client-approved MCP catalog. */
export class ModelToolSession {
  readonly #cwd: string;
  readonly #env: NodeJS.ProcessEnv;
  readonly #servers: readonly McpServer[];
  readonly #tools = new Map<string, RegisteredTool>();
  readonly #clients: { client: Client; transport: StdioClientTransport }[] = [];
  #ready = false;
  #closed = false;

  constructor(options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    mcpServers?: readonly McpServer[];
    generateImage?: (prompt: string, signal: AbortSignal) => Promise<void>;
  }) {
    this.#cwd = options.cwd;
    this.#env = options.env;
    this.#servers = options.mcpServers ?? [];
    if (this.#servers.some((server) => "type" in server))
      throw new Error("A008 supports approved stdio MCP servers only.");
    this.#register(
      {
        name: "exec_command",
        description: `Run a local ${process.platform === "win32" ? "Windows PowerShell (no profile)" : "POSIX shell"} command in ${this.#cwd}. Explicit user approval is required. Commands can read or change host files; this is not a filesystem sandbox. Use actual tool results, never claim execution from prose.`,
        parameters: {
          type: "object",
          properties: { cmd: { type: "string", minLength: 1 } },
          required: ["cmd"],
          additionalProperties: false,
        },
      },
      async (args, signal, budgets) => {
        const result = await runTerminalCommand({
          command: args.cmd as string,
          cwd: this.#cwd,
          env: toolEnvironment(this.#env),
          shell: "powershell",
          signal,
          timeoutMs: budgets.toolTimeoutMs,
          maxBytes: budgets.toolOutputBytes,
        });
        return {
          failed: result.exitCode !== 0 || result.timedOut,
          text: formatTerminalResult(result),
        };
      },
    );
    for (const tool of repositoryTools(this.#cwd, toolEnvironment(this.#env)))
      this.#register(tool.definition, tool.run);
    if (options.generateImage !== undefined) {
      this.#register(
        {
          name: "generate_image",
          description:
            "Generate one image from a natural-language description and place it in the current conversation. The host owns provider selection, storage, ordering and completion.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", minLength: 3, maxLength: 8000 },
            },
            required: ["prompt"],
            additionalProperties: false,
          },
        },
        async (args, signal) => {
          await options.generateImage!(String(args.prompt), signal);
          return {
            failed: false,
            text: JSON.stringify({
              status: "started",
              text: "Image generation started in the conversation.",
            }),
          };
        },
      );
    }
  }

  #register(definition: ChatToolDefinition, run: RegisteredTool["run"]) {
    const validate = new AjvJsonSchemaValidator().getValidator<
      Record<string, unknown>
    >(definition.parameters as JsonSchemaType);
    this.#tools.set(definition.name, { definition, validate, run });
  }

  async prepare(
    budgets: RuntimeBudgets,
    approval: ToolApproval,
    signal: AbortSignal,
  ): Promise<ChatTools> {
    if (this.#closed) throw new Error("Tool session is closed.");
    signal.throwIfAborted();
    if (!this.#ready) {
      try {
        for (const [index, server] of this.#servers.entries()) {
          if ("type" in server) throw new Error("Unsupported MCP transport.");
          const stdio = server as {
            name: string;
            command: string;
            args: string[];
            env: { name: string; value: string }[];
          };
          const transport = new StdioClientTransport({
            command: stdio.command,
            args: stdio.args,
            cwd: this.#cwd,
            env: {
              ...toolEnvironment(this.#env),
              ...Object.fromEntries(
                stdio.env.map((item) => [item.name, item.value]),
              ),
            },
            stderr: "ignore",
            maxBufferSize: budgets.chatInputBytes + budgets.toolOutputBytes,
          });
          const client = new Client({ name: "A008", version: "0.0.0" });
          this.#clients.push({ client, transport });
          await client.connect(transport, {
            signal,
            timeout: budgets.toolTimeoutMs,
          });
          let cursor: string | undefined;
          const cursors = new Set<string>();
          do {
            const result = await client.listTools(cursor ? { cursor } : {}, {
              signal,
              timeout: budgets.toolTimeoutMs,
            });
            for (const tool of result.tools) {
              if (this.#tools.size >= budgets.maximumToolDefinitions)
                throw new Error("MCP catalog exceeds Available tools budget.");
              const name = `mcp_${index}_${createHash("sha256").update(tool.name).digest("hex").slice(0, 16)}`;
              if (this.#tools.has(name))
                throw new Error("MCP server returned duplicate tools.");
              this.#register(
                {
                  name,
                  description: `${stdio.name}: ${tool.name}. ${tool.description ?? ""}`,
                  parameters: tool.inputSchema,
                },
                async (args, callSignal, limits) => {
                  const result = await client.callTool(
                    { name: tool.name, arguments: args },
                    undefined,
                    { signal: callSignal, timeout: limits.toolTimeoutMs },
                  );
                  return {
                    failed: result.isError === true,
                    text: JSON.stringify(result),
                  };
                },
              );
            }
            cursor = result.nextCursor;
            if (cursor && cursors.has(cursor))
              throw new Error("MCP server repeated its catalog cursor.");
            if (cursor) cursors.add(cursor);
          } while (cursor);
        }
        this.#ready = true;
      } catch (error) {
        await this.#disconnect();
        for (const name of this.#tools.keys())
          if (name.startsWith("mcp_")) this.#tools.delete(name);
        throw error;
      }
    }
    if (this.#tools.size > budgets.maximumToolDefinitions)
      throw new Error("Tool catalog exceeds Available tools budget.");
    return {
      definitions: [...this.#tools.values()].map((tool) => tool.definition),
      maximumCalls: budgets.maximumToolCalls,
      execute: async (call, callSignal) =>
        this.#execute(call, budgets, approval, callSignal ?? signal),
    };
  }

  async #execute(
    call: ChatToolCall,
    budgets: RuntimeBudgets,
    approval: ToolApproval,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const tool = this.#tools.get(call.name);
    if (!tool) throw new Error("Unknown tool.");
    const activity: ToolActivity = {
      id: call.id,
      name: call.name,
      cwd: this.#cwd,
      input: call.arguments,
      status: "pending",
    };
    let args: Record<string, unknown>;
    try {
      const parsed = tool.validate(JSON.parse(call.arguments));
      if (!parsed.valid) throw new Error(parsed.errorMessage);
      args = parsed.data;
    } catch {
      await approval.update({
        ...activity,
        status: "failed",
        output: "Invalid tool arguments; nothing executed.",
      });
      return JSON.stringify({
        status: "invalid_arguments",
        text: "Arguments do not match the offered tool schema. Nothing executed.",
      });
    }
    await approval.update(activity);
    // Approval failure, cancellation or unsupported clients all fail closed.
    const allowed = await approval.approve(activity, signal);
    signal.throwIfAborted();
    if (!allowed) {
      await approval.update({
        ...activity,
        status: "failed",
        output: "User denied execution.",
      });
      return JSON.stringify({
        status: "denied",
        text: "User denied execution. Do not retry this action through another tool.",
      });
    }
    await approval.update({ ...activity, status: "in_progress" });
    try {
      const result = await tool.run(args, signal, budgets);
      signal.throwIfAborted();
      const bounded = boundedToolText(result.text, budgets.toolOutputBytes);
      const text = JSON.stringify({
        status: result.failed ? "failed" : "completed",
        ...bounded,
      });
      await approval.update({
        ...activity,
        status: result.failed ? "failed" : "completed",
        output: text,
      });
      return text;
    } catch (error) {
      // SDK/provider errors may contain credentials or raw payloads. Publish no raw error.
      const text = signal.aborted
        ? "Tool cancelled."
        : error instanceof RepositoryToolError
          ? error.message
          : "Tool failed or timed out. No success confirmed.";
      await approval.update({ ...activity, status: "failed", output: text });
      signal.throwIfAborted();
      return JSON.stringify({ status: "failed", text });
    }
  }

  async #disconnect() {
    await Promise.allSettled(
      this.#clients.splice(0).map(async ({ client, transport }) => {
        // SDK close handles the server; the tree kill also covers spawned descendants.
        const pid = transport.pid ?? undefined;
        if (pid) killProcessTree(pid);
        await client.close();
      }),
    );
  }
  async close() {
    this.#closed = true;
    await this.#disconnect();
  }
}
