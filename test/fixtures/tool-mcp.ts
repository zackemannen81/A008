import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { writeFileSync } from "node:fs";

const server = new Server({ name: "isolated-test-mcp", version: "1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [{ name: "fixture_write", description: "Write synthetic fixture text.", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false } }] }));
server.setRequestHandler(CallToolRequestSchema, async request => {
  writeFileSync("mcp-fixture.txt", String(request.params.arguments?.text));
  return { content: [{ type: "text", text: "MCP fixture written." }] };
});
await server.connect(new StdioServerTransport());
