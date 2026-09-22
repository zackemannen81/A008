import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type { JsonSchemaType } from "@modelcontextprotocol/sdk/validation/types.js";
import { DEFAULT_RUNTIME_BUDGETS } from "../core/runtime-preferences.js";
import { killProcessTree } from "./terminal.js";

/** Process environment published to every MCP child. Runtime wins over configured env. */
export const MCP_EXECUTION_ENV = "A008_MCP_EXECUTION_ID";
export const MCP_SCOPE_ENV = "A008_MCP_SERVER_SCOPE";

const REPLAY_ARGUMENTS = ["restore", "state", "sessionName"] as const;

export interface StdioMcpServerSpec {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: readonly { readonly name: string; readonly value: string }[];
}

export interface McpListedTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface McpProbeObservation {
  readonly status: "ready" | "failed";
  readonly stage: "process" | "handshake" | "catalog" | "close";
  readonly toolCount?: number;
  readonly testedAt: string;
  readonly lines: readonly string[];
}

export type McpArgumentBinding =
  | { readonly ok: true; readonly arguments: Record<string, unknown> }
  | { readonly ok: false; readonly text: string };

export class McpCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpCatalogError";
  }
}

export function createMcpExecutionId(): string {
  return randomUUID();
}

/** Stable for one tool session and one MCP server name. Independent of call order. */
export function mcpServerScope(executionId: string, serverName: string): string {
  return createHash("sha256")
    .update("a008-mcp-scope\0")
    .update(executionId)
    .update("\0")
    .update(serverName)
    .digest("hex")
    .slice(0, 32);
}

export function mcpCatalogFingerprint(
  servers: readonly StdioMcpServerSpec[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        servers.map((server) => ({
          name: server.name,
          command: server.command,
          args: [...server.args],
          env: server.env.map((entry) => [entry.name, entry.value]),
        })),
      ),
    )
    .digest("hex");
}

export function mcpChildEnvironment(
  base: Record<string, string>,
  configured: readonly { readonly name: string; readonly value: string }[],
  executionId: string,
  scope: string,
): Record<string, string> {
  return {
    ...base,
    ...Object.fromEntries(configured.map((entry) => [entry.name, entry.value])),
    [MCP_EXECUTION_ENV]: executionId,
    [MCP_SCOPE_ENV]: scope,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function propertySchema(
  schema: Record<string, unknown>,
  name: string,
): unknown {
  const properties = schema.properties;
  if (!isRecord(properties)) return undefined;
  return properties[name];
}

function acceptsString(property: unknown): boolean {
  if (!isRecord(property)) return false;
  const type = property.type;
  if (type === "string") return true;
  if (Array.isArray(type) && type.includes("string")) return true;
  if (Array.isArray(property.anyOf) && property.anyOf.some(acceptsString))
    return true;
  if (Array.isArray(property.oneOf) && property.oneOf.some(acceptsString))
    return true;
  if (typeof property.const === "string") return true;
  if (
    Array.isArray(property.enum) &&
    property.enum.length > 0 &&
    property.enum.every((item) => typeof item === "string")
  )
    return true;
  return (
    type === undefined &&
    property.const === undefined &&
    property.enum === undefined &&
    property.anyOf === undefined &&
    property.oneOf === undefined
  );
}

function sessionSelector(schema: Record<string, unknown>): boolean {
  return acceptsString(propertySchema(schema, "session"));
}

/** Model-facing schema. The runtime selector is not a model argument. */
export function presentMcpSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (!sessionSelector(schema)) return schema;
  const copy = structuredClone(schema);
  const properties = copy.properties;
  if (isRecord(properties)) delete properties.session;
  if (Array.isArray(copy.required)) {
    const required = copy.required.filter((name) => name !== "session");
    if (required.length === 0) delete copy.required;
    else copy.required = required;
  }
  return copy;
}

function containmentActive(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return (
    Array.isArray(value) &&
    value.some((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function replayActive(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return isRecord(value);
}

/**
 * Fills a published string `session` argument from the server scope and
 * rejects domain containment combined with restore or state replay. The
 * server name is not consulted; only the tool schema the server published.
 */
export function bindRuntimeMcpArguments(
  schema: Record<string, unknown>,
  args: Record<string, unknown>,
  scope: string,
): McpArgumentBinding {
  const next = { ...args };
  if (sessionSelector(schema)) next.session = scope;
  if (
    propertySchema(schema, "allowedDomains") !== undefined &&
    containmentActive(next.allowedDomains)
  ) {
    for (const name of REPLAY_ARGUMENTS) {
      if (propertySchema(schema, name) === undefined) continue;
      if (!replayActive(next[name])) continue;
      return {
        ok: false,
        text: "Domain containment requires a fresh context. Restore and state replay were not executed.",
      };
    }
  }
  return { ok: true, arguments: next };
}

export async function readMcpTools(
  client: Client,
  options: { signal: AbortSignal; timeout: number; maximum: number },
): Promise<McpListedTool[]> {
  const tools: McpListedTool[] = [];
  const names = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const result = await client.listTools(cursor ? { cursor } : {}, {
      signal: options.signal,
      timeout: options.timeout,
    });
    for (const tool of result.tools) {
      if (tools.length >= options.maximum)
        throw new McpCatalogError("MCP catalog exceeds Available tools budget.");
      if (typeof tool.name !== "string" || tool.name.length === 0)
        throw new McpCatalogError("MCP server returned a tool without a name.");
      if (names.has(tool.name))
        throw new McpCatalogError("MCP server returned duplicate tools.");
      if (!isRecord(tool.inputSchema))
        throw new McpCatalogError("MCP server returned a tool without an object schema.");
      names.add(tool.name);
      tools.push({
        name: tool.name,
        ...(typeof tool.description === "string"
          ? { description: tool.description }
          : {}),
        inputSchema: tool.inputSchema,
      });
    }
    cursor = result.nextCursor;
    if (cursor && cursors.has(cursor))
      throw new McpCatalogError("MCP server repeated its catalog cursor.");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return tools;
}

function compileToolSchemas(tools: readonly McpListedTool[]): void {
  const validator = new AjvJsonSchemaValidator();
  for (const tool of tools) {
    validator.getValidator(tool.inputSchema as JsonSchemaType);
  }
}

function errorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  if (typeof error.code === "string") return error.code;
  return errorCode(error.cause);
}

function commandResolvable(
  command: string,
  env: Record<string, string>,
): boolean {
  if (
    command.includes("/") ||
    command.includes("\\") ||
    /^[A-Za-z]:/.test(command)
  )
    return existsSync(command);
  const pathValue = env.PATH ?? env.Path ?? "";
  const extensions =
    process.platform === "win32"
      ? ["", ...(env.PATHEXT ?? env.Pathext ?? ".EXE;.CMD;.BAT").split(";")]
      : [""];
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    for (const extension of extensions)
      if (existsSync(join(directory, `${command}${extension}`))) return true;
  }
  return false;
}

function startStage(error: unknown): "process" | "handshake" {
  const code = errorCode(error);
  if (
    code === "ENOENT" ||
    code === "EACCES" ||
    code === "EINVAL" ||
    code === "ENOTDIR"
  )
    return "process";
  const message = error instanceof Error ? error.message : "";
  if (message.includes("ENOENT")) return "process";
  return "handshake";
}

function numericPid(pid: number | null | undefined): number | undefined {
  return typeof pid === "number" && pid > 0 ? pid : undefined;
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopMcpChild(pid: number | undefined): Promise<boolean> {
  if (pid === undefined) return true;
  killProcessTree(pid);
  const deadline = Date.now() + 3_000;
  while (processAlive(pid) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 50));
  return !processAlive(pid);
}

function failedProbe(
  stage: McpProbeObservation["stage"],
  testedAt: string,
  lines: readonly string[],
  toolCount?: number,
): McpProbeObservation {
  return {
    status: "failed",
    stage,
    testedAt,
    lines,
    ...(toolCount === undefined ? {} : { toolCount }),
  };
}

/** Spawn, initialize, list, validate, and close. Does not call tools. */
export async function probeStdioMcpServer(input: {
  server: StdioMcpServerSpec;
  cwd: string;
  env: Record<string, string>;
  timeoutMs?: number;
  maximumTools?: number;
  executionId?: string;
}): Promise<McpProbeObservation> {
  const testedAt = new Date().toISOString();
  const timeoutMs = input.timeoutMs ?? DEFAULT_RUNTIME_BUDGETS.toolTimeoutMs;
  const maximum = input.maximumTools ?? DEFAULT_RUNTIME_BUDGETS.maximumToolDefinitions;
  const executionId = input.executionId ?? createMcpExecutionId();
  const scope = mcpServerScope(executionId, input.server.name);
  if (!commandResolvable(input.server.command, input.env))
    return failedProbe("process", testedAt, ["process did not start"]);
  const transport = new StdioClientTransport({
    command: input.server.command,
    args: [...input.server.args],
    cwd: input.cwd,
    env: mcpChildEnvironment(input.env, input.server.env, executionId, scope),
    stderr: "ignore",
    maxBufferSize:
      DEFAULT_RUNTIME_BUDGETS.chatInputBytes +
      DEFAULT_RUNTIME_BUDGETS.toolOutputBytes,
  });
  const client = new Client({ name: "A008", version: "0.0.0" });
  const signal = AbortSignal.timeout(timeoutMs);
  let handshake = false;
  let toolCount: number | undefined;
  let catalogError: unknown;
  let pid: number | undefined;
  try {
    await client.connect(transport, { signal, timeout: timeoutMs });
    handshake = true;
    pid = numericPid(transport.pid);
    const tools = await readMcpTools(client, { signal, timeout: timeoutMs, maximum });
    compileToolSchemas(tools);
    toolCount = tools.length;
  } catch (error) {
    catalogError = error;
    pid = pid ?? numericPid(transport.pid);
  }
  let closed = true;
  try {
    await client.close();
  } catch {
    closed = false;
  }
  if (!(await stopMcpChild(pid))) closed = false;
  if (!handshake) {
    const stage = startStage(catalogError);
    return failedProbe(
      stage,
      testedAt,
      stage === "process"
        ? ["process did not start"]
        : ["process started", "MCP handshake failed"],
    );
  }
  if (toolCount === undefined) {
    const lines =
      catalogError instanceof McpCatalogError
        ? ["process started", "MCP catalog validation failed"]
        : ["process started", "MCP tools/list failed"];
    return failedProbe("catalog", testedAt, lines);
  }
  if (!closed)
    return failedProbe(
      "close",
      testedAt,
      ["catalog validated", "MCP server did not close"],
      toolCount,
    );
  return {
    status: "ready",
    stage: "close",
    toolCount,
    testedAt,
    lines: [`${toolCount} tools discovered`],
  };
}
