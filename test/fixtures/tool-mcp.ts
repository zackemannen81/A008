import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { writeFileSync } from "node:fs";

const report = process.env.A008_PROBE_REPORT;
if (report)
  writeFileSync(
    report,
    JSON.stringify({
      pid: process.pid,
      secret: process.env.NVIDIA_API_KEY !== undefined,
      mode: process.env.MODE ?? "",
      scope: process.env.A008_MCP_SERVER_SCOPE ?? "",
      execution: process.env.A008_MCP_EXECUTION_ID ?? "",
    }),
  );
if (process.env.FIXTURE_MODE === "exit") process.exit(1);

const duplicate = process.env.FIXTURE_MODE === "bad-catalog";
const tools = duplicate
  ? [
      {
        name: "dup",
        description: "Duplicate catalog entry.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "dup",
        description: "Duplicate catalog entry.",
        inputSchema: { type: "object", properties: {} },
      },
    ]
  : [
      {
        name: "fixture_write",
        description: "Write synthetic fixture text.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
          additionalProperties: false,
        },
      },
      {
        name: "fixture_optional",
        description: "Observe an optional strict-provider sentinel field.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            restore: { oneOf: [{ type: "boolean" }, { type: "string" }] },
          },
          required: ["url"],
          additionalProperties: false,
        },
      },
      {
        name: "fixture_scope",
        description: "Echo the runtime session scope.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            session: { type: "string" },
            allowedDomains: { type: "array", items: { type: "string" } },
            restore: { type: "string" },
            state: { type: "string" },
            sessionName: { type: "string" },
          },
          required: ["url"],
          additionalProperties: false,
        },
      },
    ];

const server = new Server(
  { name: "isolated-test-mcp", version: "1" },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "fixture_scope") {
    writeFileSync("mcp-scope-called.txt", "called");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            arguments: request.params.arguments ?? {},
            scope: process.env.A008_MCP_SERVER_SCOPE ?? "",
            execution: process.env.A008_MCP_EXECUTION_ID ?? "",
            secret: process.env.NVIDIA_API_KEY !== undefined,
          }),
        },
      ],
    };
  }
  if (request.params.name === "fixture_optional")
    return {
      content: [
        { type: "text", text: JSON.stringify(request.params.arguments ?? {}) },
      ],
    };
  writeFileSync("mcp-fixture.txt", String(request.params.arguments?.text));
  return { content: [{ type: "text", text: "MCP fixture written." }] };
});
await server.connect(new StdioServerTransport());
