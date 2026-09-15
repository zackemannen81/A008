import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { v1JsonSchemas, v1OpenApiDocument, v2AuthJsonSchemas, v2AuthOpenApiDocument, v2SessionJsonSchemas } from "../dist/packages/protocol/src/index.js";
const directory = new URL("../packages/protocol/schemas/", import.meta.url);
mkdirSync(directory, { recursive: true });
for (const [name, schema] of Object.entries({ ...v1JsonSchemas(), ...v2AuthJsonSchemas(), ...v2SessionJsonSchemas() })) {
  writeFileSync(fileURLToPath(new URL(`${name}.schema.json`, directory)), JSON.stringify(schema, null, 2) + "\n");
}
writeFileSync(fileURLToPath(new URL("http.openapi.json", directory)), JSON.stringify(v1OpenApiDocument(), null, 2) + "\n");
writeFileSync(fileURLToPath(new URL("v2-auth.openapi.json", directory)), JSON.stringify(v2AuthOpenApiDocument(), null, 2) + "\n");
