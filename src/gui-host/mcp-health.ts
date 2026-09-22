import { ChatError } from "../core/errors.js";
import { loadUserCatalog, type UserMcpServer } from "../core/user-catalog.js";
import { toolEnvironment } from "../tools/model-tools.js";
import {
  mcpCatalogFingerprint,
  probeStdioMcpServer,
  type McpProbeObservation,
  type StdioMcpServerSpec,
} from "../tools/mcp-runtime.js";

export interface McpServerHealthEntry {
  readonly name: string;
  readonly status: "ready" | "failed" | "restart_required" | "untested";
  readonly stage?: McpProbeObservation["stage"];
  readonly toolCount?: number;
  readonly testedAt?: string;
  readonly lines: readonly string[];
}

export interface McpServerHealth {
  readonly restartRequired: boolean;
  readonly servers: readonly McpServerHealthEntry[];
}

/** Catalog fingerprints captured when host sessions were constructed. */
export class McpRuntimeLedger {
  readonly #bound = new Map<string, string>();

  note(sessionId: string, servers: readonly object[]): void {
    this.#bound.set(sessionId, mcpCatalogFingerprint(stdioSpecs(servers)));
  }

  release(sessionId: string): void {
    this.#bound.delete(sessionId);
  }

  restartRequired(servers: readonly StdioMcpServerSpec[]): boolean {
    const current = mcpCatalogFingerprint(servers);
    for (const bound of this.#bound.values()) if (bound !== current) return true;
    return false;
  }
}

/** Last probe for a saved server definition. Lost when the host process exits. */
export class McpProbeMemory {
  readonly #results = new Map<string, McpProbeObservation>();

  remember(server: StdioMcpServerSpec, observation: McpProbeObservation): void {
    this.#results.set(mcpCatalogFingerprint([server]), observation);
  }

  recall(server: StdioMcpServerSpec): McpProbeObservation | undefined {
    return this.#results.get(mcpCatalogFingerprint([server]));
  }
}

function stdioSpecs(servers: readonly object[]): StdioMcpServerSpec[] {
  return servers.flatMap((server) => {
    if (
      !("name" in server) ||
      !("command" in server) ||
      !("args" in server) ||
      !("env" in server) ||
      typeof server.name !== "string" ||
      typeof server.command !== "string" ||
      !Array.isArray(server.args) ||
      !server.args.every((arg) => typeof arg === "string") ||
      !Array.isArray(server.env)
    )
      return [];
    const env: { name: string; value: string }[] = [];
    for (const entry of server.env) {
      if (
        !entry ||
        typeof entry !== "object" ||
        !("name" in entry) ||
        !("value" in entry) ||
        typeof entry.name !== "string" ||
        typeof entry.value !== "string"
      )
        return [];
      env.push({ name: entry.name, value: entry.value });
    }
    return [
      {
        name: server.name,
        command: server.command,
        args: [...server.args],
        env,
      },
    ];
  });
}

function spec(server: UserMcpServer): StdioMcpServerSpec {
  return {
    name: server.name,
    command: server.command,
    args: server.args,
    env: server.env,
  };
}

function entryFor(
  server: UserMcpServer,
  observation: McpProbeObservation | undefined,
  restartRequired: boolean,
): McpServerHealthEntry {
  if (observation?.status === "failed") {
    return {
      name: server.name,
      status: "failed",
      stage: observation.stage,
      ...(observation.toolCount === undefined
        ? {}
        : { toolCount: observation.toolCount }),
      testedAt: observation.testedAt,
      lines: observation.lines,
    };
  }
  if (restartRequired) {
    return {
      name: server.name,
      status: "restart_required",
      ...(observation?.toolCount === undefined
        ? {}
        : { toolCount: observation.toolCount }),
      ...(observation ? { testedAt: observation.testedAt } : {}),
      lines: [
        "configuration saved",
        "active chat still uses previous MCP catalog",
      ],
    };
  }
  if (observation?.status === "ready") {
    return {
      name: server.name,
      status: "ready",
      toolCount: observation.toolCount ?? 0,
      testedAt: observation.testedAt,
      lines: observation.lines,
    };
  }
  return { name: server.name, status: "untested", lines: ["Not tested"] };
}

export function mcpHealthView(input: {
  catalogPath: string;
  ledger: McpRuntimeLedger;
  probes: McpProbeMemory;
}): McpServerHealth {
  const catalog = loadUserCatalog(input.catalogPath);
  const enabled = catalog.mcpServers.filter((server) => server.enabled).map(spec);
  const restartRequired = input.ledger.restartRequired(enabled);
  return {
    restartRequired,
    servers: catalog.mcpServers.map((server) =>
      entryFor(server, input.probes.recall(spec(server)), restartRequired),
    ),
  };
}

export async function probeSavedMcpServer(input: {
  catalogPath: string;
  name: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  ledger: McpRuntimeLedger;
  probes: McpProbeMemory;
}): Promise<McpServerHealth> {
  const name = input.name.trim();
  const server = loadUserCatalog(input.catalogPath).mcpServers.find(
    (item) => item.name === name,
  );
  if (!server)
    throw new ChatError("configuration", "MCP server was not found.");
  const observation = await probeStdioMcpServer({
    server: spec(server),
    cwd: input.cwd,
    env: toolEnvironment(input.env),
  });
  input.probes.remember(spec(server), observation);
  return mcpHealthView(input);
}
