import {
  mcpToolPolicySchema,
  type McpToolPolicy,
} from "../../packages/protocol/src/http-schemas.js";

/** ACP extension owned by A008; never forwarded as MCP process environment. */
export const MCP_TOOL_POLICY_META = "a008/toolPolicy";

export function mcpToolPolicy(server: {
  readonly _meta?: Record<string, unknown> | null;
}): McpToolPolicy {
  const value = server._meta?.[MCP_TOOL_POLICY_META];
  return mcpToolPolicySchema.parse(value === undefined ? {} : value);
}

export function effectiveMcpStrict(
  policy: McpToolPolicy,
  toolName: string,
): boolean {
  return (
    (policy.toolStrict && Object.hasOwn(policy.toolStrict, toolName)
      ? policy.toolStrict[toolName]
      : undefined) ??
    policy.strict ??
    true
  );
}
