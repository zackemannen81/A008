import { createHash } from "node:crypto";
import type { McpServer } from "@agentclientprotocol/sdk";
import { effectiveMcpStrict, mcpToolPolicy } from "../core/mcp-tool-policy.js";
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
import type { ToolOutcome } from "../../packages/protocol/src/index.js";
import {
  runTerminalCommand,
  formatTerminalResult,
  terminalFeedback,
  TerminalStartError,
  killProcessTree,
} from "./terminal.js";
import {
  repositoryTools,
  RepositoryToolError,
  nativeOutputBytes,
  TOOL_OUTPUT_BYTES_PROPERTY,
} from "./repository-tools.js";
import { EDIT_FAILURE_OUTPUT_BYTES } from "./file-edit-engine.js";
import {
  bindRuntimeMcpArguments,
  createMcpExecutionId,
  mcpChildEnvironment,
  mcpServerScope,
  presentMcpSchema,
  readMcpTools,
  type McpArgumentBinding,
} from "./mcp-runtime.js";

export interface ToolActivity {
  readonly id: string;
  readonly name: string;
  readonly input: string;
  readonly cwd: string;
  readonly status: "pending" | "in_progress" | "completed" | "failed";
  readonly output?: string;
  readonly outcome?: ToolOutcome;
  readonly modelVisibleBytes?: number;
}
export interface ToolApproval {
  approve(activity: ToolActivity, signal: AbortSignal): Promise<boolean>;
  update(activity: ToolActivity): Promise<void>;
}
interface RegisteredTool {
  definition: ChatToolDefinition;
  validate: JsonSchemaValidator<Record<string, unknown>>;
  validateParameters: Record<string, unknown>;
  bind?: (args: Record<string, unknown>) => McpArgumentBinding;
  run(
    args: Record<string, unknown>,
    signal: AbortSignal,
    budgets: RuntimeBudgets,
  ): Promise<{
    failed: boolean;
    text: string;
    outcome?: ToolOutcome;
    /** Inspector-facing bounded observation; never returned to the model. */
    displayText?: string;
  }>;
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

function repositoryOutcome(error: RepositoryToolError): ToolOutcome {
  const code = error.details?.code;
  if (
    code === "stale_base" ||
    code === "no_exact_match" ||
    code === "ambiguous_match" ||
    code === "count_mismatch"
  )
    return code;
  return "protocol_error";
}

function repositoryFailureResult(error: RepositoryToolError): string {
  const full = JSON.stringify({
    status: "failed",
    outcome: repositoryOutcome(error),
    text: error.message,
    ...(error.details ?? {}),
  });
  if (Buffer.byteLength(full, "utf8") <= EDIT_FAILURE_OUTPUT_BYTES) return full;
  const details = error.details ?? {};
  return JSON.stringify({
    status: "failed",
    outcome: repositoryOutcome(error),
    text: error.message,
    ...(typeof details.code === "string" ? { code: details.code } : {}),
    ...(typeof details.retryable === "boolean"
      ? { retryable: details.retryable }
      : {}),
    ...(typeof details.written === "boolean"
      ? { written: details.written }
      : {}),
    ...(typeof details.expectedSha256 === "string"
      ? { expectedSha256: details.expectedSha256 }
      : {}),
    ...(typeof details.currentSha256 === "string"
      ? { currentSha256: details.currentSha256 }
      : {}),
    ...(typeof details.actualOccurrences === "number"
      ? { actualOccurrences: details.actualOccurrences }
      : {}),
    ...(typeof details.expectedOccurrences === "number"
      ? { expectedOccurrences: details.expectedOccurrences }
      : {}),
    ...(Array.isArray(details.matches) ? { matches: details.matches } : {}),
    diagnosticTruncated: true,
  });
}

function schemaAcceptsNull(schema: unknown): boolean {
  if (schema === true) return true;
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return false;
  const value = schema as Record<string, unknown>;
  const type = value.type;
  if (type === "null" || (Array.isArray(type) && type.includes("null")))
    return true;
  if (value.const === null) return true;
  if (Array.isArray(value.enum) && value.enum.includes(null)) return true;
  for (const keyword of ["anyOf", "oneOf"] as const) {
    const alternatives = value[keyword];
    if (Array.isArray(alternatives) && alternatives.some(schemaAcceptsNull))
      return true;
  }
  const allOf = value.allOf;
  return Array.isArray(allOf) && allOf.every(schemaAcceptsNull);
}

/**
 * OpenAI strict tools encode original optional properties as nullable-required.
 * Restore only that omission sentinel before the original MCP schema validates
 * execution; required and explicitly nullable properties retain their value.
 */
export function normalizeOptionalNullArguments(
  parameters: Record<string, unknown>,
  args: unknown,
): unknown {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;
  const properties = parameters.properties;
  if (
    !properties ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  )
    return args;
  const required = new Set(
    Array.isArray(parameters.required)
      ? parameters.required.filter(
          (name): name is string => typeof name === "string",
        )
      : [],
  );
  const normalized = { ...(args as Record<string, unknown>) };
  for (const [name, value] of Object.entries(normalized)) {
    if (value !== null || required.has(name)) continue;
    const property = (properties as Record<string, unknown>)[name];
    if (property !== undefined && !schemaAcceptsNull(property))
      delete normalized[name];
  }
  return normalized;
}

/** One session's native tool and explicitly supplied, client-approved MCP catalog. */
export class ModelToolSession {
  readonly #cwd: string;
  readonly #env: NodeJS.ProcessEnv;
  readonly #servers: readonly McpServer[];
  readonly #executionId: string;
  readonly #tools = new Map<string, RegisteredTool>();
  readonly #clients: { client: Client; transport: StdioClientTransport }[] = [];
  #ready = false;
  #closed = false;

  constructor(options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    mcpServers?: readonly McpServer[];
    executionId?: string;
    generateImage?: (prompt: string, signal: AbortSignal) => Promise<void>;
  }) {
    this.#cwd = options.cwd;
    this.#env = options.env;
    this.#servers = options.mcpServers ?? [];
    this.#executionId = options.executionId ?? createMcpExecutionId();
    if (this.#servers.some((server) => "type" in server))
      throw new Error("A008 supports approved stdio MCP servers only.");
    this.#register(
      {
        name: "exec_command",
        description: `Run a local ${process.platform === "win32" ? "Windows PowerShell (no profile)" : "POSIX shell"} command in ${this.#cwd}. Prefer native read/edit/list/create/git for workspace files; do not use shell/Python as an alternate writer for ordinary workspace text changes that edit_file/create_file can represent, because that bypasses revision ownership. Use targeted verification or narrow searches here. Use MCP for interactive processes or structured documents. Model feedback is compact; the runtime inspector retains the bounded command observation. Requires approval; host access is not sandboxed. Report actual results.`,
        parameters: {
          type: "object",
          properties: {
            cmd: { type: "string", minLength: 1 },
            max_output_bytes: TOOL_OUTPUT_BYTES_PROPERTY,
          },
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
          maxBytes: nativeOutputBytes(args, budgets),
        });
        const outcome: ToolOutcome = result.timedOut
          ? "timeout"
          : result.processLost
            ? "process_lost"
            : result.exitCode === 0
              ? "command_success"
              : "command_nonzero";
        return {
          failed: result.timedOut || result.processLost === true,
          outcome,
          text: terminalFeedback(result, nativeOutputBytes(args, budgets)),
          displayText: formatTerminalResult(result),
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

  #register(
    definition: ChatToolDefinition,
    run: RegisteredTool["run"],
    options?: {
      validateParameters?: Record<string, unknown>;
      bind?: RegisteredTool["bind"];
    },
  ) {
    const validateParameters =
      options?.validateParameters ??
      (definition.parameters as Record<string, unknown>);
    if (options?.validateParameters === undefined && definition.name === "edit_file") {
      const parameters = definition.parameters as Record<string, any>;
      definition = {
        ...definition,
        parameters: {
          ...parameters,
          properties: {
            ...parameters.properties,
            expected_replacements: {
              ...parameters.properties.expected_replacements,
              type: ["integer", "null"],
            },
          },
          required: Object.keys(parameters.properties).filter(
            (name) => name !== "expected_replacements",
          ),
        },
      };
      validateParameters.properties = {
        ...((validateParameters.properties as Record<string, unknown>) ?? {}),
        expected_replacements: {
          ...((validateParameters.properties as Record<string, any>).expected_replacements as Record<string, unknown>),
          type: ["integer", "null"],
        },
      };
      validateParameters.required = (
        validateParameters.required as string[]
      ).filter((name) => name !== "expected_replacements");
    }
    const validate = new AjvJsonSchemaValidator().getValidator<
      Record<string, unknown>
    >(validateParameters as JsonSchemaType);
    this.#tools.set(definition.name, {
      definition,
      validate,
      validateParameters,
      ...(options?.bind ? { bind: options.bind } : {}),
      run,
    });
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
          const policy = mcpToolPolicy(server);
          if ("type" in server) throw new Error("Unsupported MCP transport.");
          const stdio = server as {
            name: string;
            command: string;
            args: string[];
            env: { name: string; value: string }[];
          };
          const scope = mcpServerScope(this.#executionId, stdio.name);
          const transport = new StdioClientTransport({
            command: stdio.command,
            args: stdio.args,
            cwd: this.#cwd,
            env: mcpChildEnvironment(
              toolEnvironment(this.#env),
              stdio.env,
              this.#executionId,
              scope,
            ),
            stderr: "ignore",
            maxBufferSize: budgets.chatInputBytes + budgets.toolOutputBytes,
          });
          const client = new Client({ name: "A008", version: "0.0.0" });
          this.#clients.push({ client, transport });
          await client.connect(transport, {
            signal,
            timeout: budgets.toolTimeoutMs,
          });
          const listed = await readMcpTools(client, {
            signal,
            timeout: budgets.toolTimeoutMs,
            maximum: budgets.maximumToolDefinitions - this.#tools.size,
          });
          for (const tool of listed) {
            const name = `mcp_${index}_${createHash("sha256").update(tool.name).digest("hex").slice(0, 16)}`;
            if (this.#tools.has(name))
              throw new Error("MCP server returned duplicate tools.");
            const original = tool.inputSchema;
            this.#register(
              {
                name,
                description: `${stdio.name}: ${tool.name}. ${tool.description ?? ""}`,
                parameters: presentMcpSchema(original),
                strict: effectiveMcpStrict(policy, tool.name),
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
              {
                validateParameters: original,
                bind: (args) => bindRuntimeMcpArguments(original, args, scope),
              },
            );
          }
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
    let args: Record<string, unknown>;
    let invalidText =
      "Arguments do not match the offered tool schema. Nothing executed.";
    try {
      const normalized =
        tool.definition.strict === false
          ? JSON.parse(call.arguments)
          : normalizeOptionalNullArguments(
              tool.validateParameters,
              JSON.parse(call.arguments),
            );
      if (
        !normalized ||
        typeof normalized !== "object" ||
        Array.isArray(normalized)
      )
        throw new Error("invalid");
      const record = normalized as Record<string, unknown>;
      if (tool.definition.name === "edit_file" && record.expected_replacements === null)
        delete record.expected_replacements;
      const bound = tool.bind
        ? tool.bind(record)
        : { ok: true as const, arguments: record };
      if (!bound.ok) {
        invalidText = bound.text;
        throw new Error(bound.text);
      }
      const parsed = tool.validate(bound.arguments);
      if (!parsed.valid) throw new Error(parsed.errorMessage);
      args = parsed.data;
    } catch {
      const resultText = JSON.stringify({
        status: "invalid_arguments",
        outcome: "invalid_arguments",
        text: invalidText,
      });
      const modelVisibleBytes = Buffer.byteLength(resultText, "utf8");
      const activity: ToolActivity = {
        id: call.id,
        name: call.name,
        cwd: this.#cwd,
        input: call.arguments,
        status: "failed",
        outcome: "invalid_arguments",
        modelVisibleBytes,
        output: JSON.stringify({
          status: "invalid_arguments",
          outcome: "invalid_arguments",
          modelVisibleBytes,
          text: invalidText,
        }),
      };
      await approval.update(activity);
      return resultText;
    }
    const activity: ToolActivity = {
      id: call.id,
      name: call.name,
      cwd: this.#cwd,
      input: JSON.stringify(args),
      status: "pending",
    };
    await approval.update(activity);
    // Approval failure, cancellation or unsupported clients all fail closed.
    const allowed = await approval.approve(activity, signal);
    signal.throwIfAborted();
    if (!allowed) {
      const resultText = JSON.stringify({
        status: "denied",
        outcome: "denied",
        text: "User denied execution. Do not retry this action through another tool.",
      });
      const modelVisibleBytes = Buffer.byteLength(resultText, "utf8");
      await approval.update({
        ...activity,
        status: "failed",
        outcome: "denied",
        modelVisibleBytes,
        output: JSON.stringify({
          status: "denied",
          outcome: "denied",
          modelVisibleBytes,
          text: "User denied execution.",
        }),
      });
      return resultText;
    }
    await approval.update({ ...activity, status: "in_progress" });
    try {
      const result = await tool.run(args, signal, budgets);
      signal.throwIfAborted();
      const maximum = ["exec_command", "git", "read_file"].includes(call.name)
        ? nativeOutputBytes(args, budgets)
        : budgets.toolOutputBytes;
      const bounded = boundedToolText(result.text, maximum);
      const outcome = result.outcome ?? (result.failed ? "protocol_error" : "tool_success");
      const text = JSON.stringify({
        status: result.failed ? "failed" : "completed",
        outcome,
        ...bounded,
      });
      const modelVisibleBytes = Buffer.byteLength(text, "utf8");
      const inspectorText = result.displayText === undefined
        ? JSON.stringify({
            status: result.failed ? "failed" : "completed",
            outcome,
            modelVisibleBytes,
            ...bounded,
          })
        : JSON.stringify({
            status: result.failed ? "failed" : "completed",
            outcome,
            modelVisibleBytes,
            text: result.displayText,
            truncated: false,
          });
      await approval.update({
        ...activity,
        status: result.failed ? "failed" : "completed",
        outcome,
        modelVisibleBytes,
        output: inspectorText,
      });
      return text;
    } catch (error) {
      // SDK/provider errors may contain credentials or raw payloads. Publish no raw error.
      if (!signal.aborted && error instanceof RepositoryToolError) {
        const text = repositoryFailureResult(error);
        const modelVisibleBytes = Buffer.byteLength(text, "utf8");
        const parsed = JSON.parse(text) as Record<string, unknown>;
        await approval.update({
          ...activity,
          status: "failed",
          outcome: repositoryOutcome(error),
          modelVisibleBytes,
          output: JSON.stringify({ ...parsed, modelVisibleBytes }),
        });
        return text;
      }
      const outcome: ToolOutcome = signal.aborted
        ? "cancelled"
        : error instanceof TerminalStartError
          ? "spawn_failed"
          : "protocol_error";
      const text = signal.aborted
        ? "Tool cancelled."
        : error instanceof TerminalStartError
          ? error.message
          : "Tool failed. No success confirmed.";
      const resultText = JSON.stringify({ status: "failed", outcome, text });
      await approval.update({
        ...activity,
        status: "failed",
        outcome,
        modelVisibleBytes: Buffer.byteLength(resultText, "utf8"),
        output: JSON.stringify({
          status: "failed",
          outcome,
          modelVisibleBytes: Buffer.byteLength(resultText, "utf8"),
          text,
        }),
      });
      signal.throwIfAborted();
      return resultText;
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
