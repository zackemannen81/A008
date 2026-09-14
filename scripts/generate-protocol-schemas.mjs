import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { v1JsonSchemas } from "../dist/packages/protocol/src/index.js";
const directory = new URL("../packages/protocol/schemas/", import.meta.url);
mkdirSync(directory, { recursive: true });
for (const [name, schema] of Object.entries(v1JsonSchemas())) {
  writeFileSync(fileURLToPath(new URL(`${name}.schema.json`, directory)), JSON.stringify(schema, null, 2) + "\n");
}
