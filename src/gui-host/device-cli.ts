#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { v2CapabilitySchema } from "../../packages/protocol/src/index.js";
import { DeviceRegistry } from "./device-registry.js";

export function runDeviceCli(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): unknown {
  const registry = new DeviceRegistry(env),
    [action, ...rest] = args;
  if (action === "list" && !rest.length) return registry.list();
  if (action === "revoke" && rest.length === 1)
    return { revoked: registry.revoke(rest[0]!) };
  if (action !== "grant")
    throw new Error(
      "Usage: device grant --name NAME --project ID --capability CAP [--days 1..30]; device list; device revoke ID",
    );
  let name = "",
    days = 30;
  const projects: string[] = [],
    capabilities: ReturnType<typeof v2CapabilitySchema.parse>[] = [];
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i],
      value = rest[i + 1];
    if (!value) throw new Error("Each grant option needs a value.");
    if (key === "--name" && !name) name = value;
    else if (key === "--project") projects.push(value);
    else if (key === "--capability")
      capabilities.push(v2CapabilitySchema.parse(value));
    else if (key === "--days") days = Number(value);
    else throw new Error("Unknown or duplicate grant option.");
  }
  return registry.grant({ name, projects, capabilities, expiresInDays: days });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.stdout.write(
      `${JSON.stringify(runDeviceCli(process.argv.slice(2), process.env))}\n`,
    );
  } catch {
    process.stderr.write(
      "Device operation failed. Check grant arguments, capabilities and local registry configuration.\n",
    );
    process.exitCode = 1;
  }
}
