import { z } from "zod";
import { v1HttpSchemas, hostModelsResponseSchema } from "./http-schemas.js";
import { v1HttpRoutes } from "./routes.js";

export const httpContractSchemas = {
  ...v1HttpSchemas,
  models: hostModelsResponseSchema,
  frameQuery: z.object({ url: z.string() }),
  directoryQuery: z.object({ path: z.string() }),
  catalogRemoveQuery: z.object({ id: z.string() }),
  blobPath: z.object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    name: z.string().min(1),
  }),
  uploadHeaders: z.object({ "x-a008-filename": z.string().optional() }),
} as const;
type SchemaName = keyof typeof httpContractSchemas;
interface Payloads {
  response: SchemaName | "binary" | "static";
  body?: SchemaName | "binary";
  query?: SchemaName;
  pathParameters?: SchemaName;
  headers?: SchemaName;
}
const payloads: Readonly<Record<string, Payloads>> = {
  "GET /health": { response: "health" },
  "POST /auth/login": { body: "loginInput", response: "loginResult" },
  "GET /v1/models": { response: "models" },
  "GET /v1/memory": { query: "memoryQuery", response: "memorySnapshot" },
  "GET /v1/browser/frame-check": {
    query: "frameQuery",
    response: "frameCheck",
  },
  "GET /v1/catalog/kie": { response: "kieCatalog" },
  "GET /v1/mcp-servers": { response: "mcpServerCatalog" },
  "POST /v1/mcp-servers": {
    body: "mcpServerCatalogInput",
    response: "mcpServerCatalog",
  },
  "GET /v1/catalog/zero-cost": { response: "zeroCostCatalog" },
  "POST /v1/catalog/zero-cost": { response: "zeroCostCatalog" },
  "GET /v1/catalog/nvidia": { response: "nvidiaCatalog" },
  "POST /v1/catalog/nvidia": {
    body: "catalogAddInput",
    response: "catalogAdded",
  },
  "DELETE /v1/catalog/nvidia": {
    query: "catalogRemoveQuery",
    response: "catalogRemoved",
  },
  "GET /v1/provider-settings": { response: "providerSettings" },
  "POST /v1/provider-settings": {
    body: "providerSettingsInput",
    response: "providerSettings",
  },
  "POST /v1/images": { body: "imageInput", response: "generatedImage" },
  "GET /v1/blobs/{sha256}/{name}": {
    pathParameters: "blobPath",
    response: "binary",
  },
  "GET /v1/projects": { response: "projects" },
  "GET /v1/projects/browse": {
    query: "directoryQuery",
    response: "directoryList",
  },
  "POST /v1/projects/preview": {
    body: "projectBootstrapInput",
    response: "projectPlan",
  },
  "POST /v1/projects/bootstrap": {
    body: "projectBootstrapInput",
    response: "projectCreated",
  },
  "POST /v1/projects/register": {
    body: "existingProjectRegistration",
    response: "registeredProject",
  },
  "POST /v1/projects/open": {
    body: "projectOpen",
    response: "workspaceBinding",
  },
  "POST /v1/shell": { body: "shellInput", response: "shellResult" },
  "POST /v1/upload": {
    body: "binary",
    headers: "uploadHeaders",
    response: "uploadedSource",
  },
  "GET/HEAD /{asset}": { response: "static" },
};
if (Object.keys(payloads).length !== v1HttpRoutes.length)
  throw new Error("HTTP payload inventory mismatch.");
export const v1HttpOperations = v1HttpRoutes.map(
  ([method, path, context, owner]) => {
    const contract = payloads[`${method} ${path}`];
    if (!contract) throw new Error(`Missing HTTP contract: ${method} ${path}`);
    return { method, path, context, owner, ...contract };
  },
);

/** Uses the JSON response contract without changing host/client dispatch policy. */
export function validateV1HttpResponse(
  method: string,
  pathname: string,
  status: number,
  value: unknown,
): boolean {
  if (status >= 400) return v1HttpSchemas.httpError.safeParse(value).success;
  const operation = v1HttpOperations.find(
    (op) => op.method === method && op.path === pathname,
  );
  if (
    !operation ||
    operation.response === "binary" ||
    operation.response === "static"
  )
    return false;
  return httpContractSchemas[operation.response].safeParse(value).success;
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonContent = (name: string) => ({
  "application/json": { schema: ref(name) },
});
/** Pure derivation; schemas remain the single shape owner. */
export function v1OpenApiDocument() {
  const schemas = Object.fromEntries(
    Object.entries(httpContractSchemas).map(([name, schema]) => {
      const raw = z.toJSONSchema(schema, {
        target: "draft-2020-12",
        io: "input",
        reused: "ref",
      });
      // References generated within each component must resolve from the OAS root.
      const rewritten = JSON.parse(
        JSON.stringify(raw).replaceAll(
          '"#/$defs/',
          `"#/components/schemas/${name}/$defs/`,
        ),
      );
      return [name, rewritten];
    }),
  );
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of v1HttpOperations) {
    for (const method of operation.method.split("/")) {
      const parameters: unknown[] = [];
      for (const [where, key] of [
        ["query", operation.query],
        ["path", operation.pathParameters],
        ["header", operation.headers],
      ] as const) {
        if (!key) continue;
        const schema = schemas[key];
        for (const name of Object.keys(schema.properties))
          parameters.push({
            in: where,
            name,
            required:
              where === "path" || (schema.required ?? []).includes(name),
            schema: { $ref: `#/components/schemas/${key}/properties/${name}` },
          });
      }
      if (operation.response === "static")
        parameters.push({
          in: "path",
          name: "asset",
          required: true,
          schema: { type: "string" },
          description:
            "Descriptive asset placeholder; the host also serves / and nested static paths.",
        });
      const content =
        operation.response === "binary"
          ? { "image/png": {}, "image/jpeg": {} }
          : operation.response === "static"
            ? { "*/*": {} }
            : jsonContent(operation.response);
      paths[operation.path] ??= {};
      paths[operation.path]![method.toLowerCase()] = {
        summary: operation.context,
        "x-a008-owner": operation.owner,
        "x-a008-auth-profile": operation.path.startsWith("/v1/")
          ? "Configured host gate: PIN cookie or engine token; no gate when neither is configured."
          : "Public; login exists only with PIN enabled.",
        parameters,
        ...(operation.body
          ? {
              requestBody: {
                required: true,
                content:
                  operation.body === "binary"
                    ? { "application/octet-stream": {} }
                    : jsonContent(operation.body),
              },
            }
          : {}),
        responses: {
          "200": {
            description:
              "Existing v1 success; runtime semantics remain documented separately.",
            ...(method === "HEAD" ? {} : { content }),
            ...(operation.path === "/auth/login"
              ? {
                  headers: {
                    "Set-Cookie": {
                      schema: { type: "string" },
                      description:
                        "a008_auth; HttpOnly; SameSite=Strict; Path=/; 24 hours; Secure on HTTPS.",
                    },
                  },
                }
              : {}),
          },
          default: {
            description:
              "Existing error. HEAD has no response body; other methods use the JSON error envelope. Origin/auth/content-type, input and runtime failures retain their current status and text.",
            ...(method === "HEAD" ? {} : { content: jsonContent("httpError") }),
          },
        },
        security: operation.path.startsWith("/v1/")
          ? [
              {},
              { pinCookie: [] },
              { engineBearer: [] },
              { engineAccessQuery: [] },
            ]
          : [],
      };
    }
  }
  return {
    openapi: "3.1.1",
    info: {
      title: "A008 existing host HTTP v1",
      version: "1.0.0",
      description:
        "Structural current-v1 contracts, not V2. Runtime policy, normalization, cross-field graph/budget rules, configured auth profiles and socket lifetimes are specified in HOST_PROTOCOL.md and the package README. No OpenAPI endpoint is added.",
    },
    paths,
    components: {
      schemas,
      securitySchemes: {
        pinCookie: { type: "apiKey", in: "cookie", name: "a008_auth" },
        engineBearer: { type: "http", scheme: "bearer" },
        engineAccessQuery: { type: "apiKey", in: "query", name: "access" },
      },
    },
  };
}
