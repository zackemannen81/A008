import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  parseMemorySnapshot,
  parseUploadedSource,
  parseShellHostResult,
  parseFrameCheck,
  v1OpenApiDocument,
  v1HttpOperations,
  httpContractSchemas,
  validateV1HttpResponse,
  memorySnapshotSchema,
  type ProjectCreated,
  type GeneratedImage,
} from "../packages/protocol/src/index.js";
import { startGuiHost } from "../src/gui-host/server.js";
import type { AcpBridge } from "../src/gui-host/acp-bridge.js";
import { createKnowledgeContext } from "../src/memory/knowledge/index.js";
import { inspectKnowledge } from "../src/memory/knowledge/inspection.js";
import { ingest } from "../src/memory/knowledge/ingest.js";

test("HTTP compatibility parsers preserve all 52 pre-extraction cases", () => {
  const fixture = JSON.parse(
    readFileSync(
      "packages/protocol/fixtures/v1-http-compatibility.json",
      "utf8",
    ),
  ) as {
    cases: {
      kind: string;
      raw: unknown;
      value?: unknown;
      error?: string;
      name?: string;
    }[];
  };
  for (const { kind, raw, ...expected } of fixture.cases) {
    let actual: unknown;
    try {
      const value =
        kind === "memory"
          ? parseMemorySnapshot(raw)
          : kind === "upload"
            ? parseUploadedSource(raw)
            : kind === "shell"
              ? parseShellHostResult(raw)
              : parseFrameCheck(raw, "https://example.test/fallback");
      actual = JSON.parse(JSON.stringify({ value }));
    } catch (error) {
      actual = { error: (error as Error).message, name: (error as Error).name };
    }
    assert.deepEqual(actual, expected, `${kind}: ${JSON.stringify(raw)}`);
  }
});

test("OpenAPI derives every operation/schema and all generated references resolve", () => {
  const spec = v1OpenApiDocument();
  assert.deepEqual(
    spec,
    JSON.parse(
      readFileSync("packages/protocol/schemas/http.openapi.json", "utf8"),
    ),
  );
  assert.equal(
    Object.values(spec.paths).reduce(
      (n, methods) => n + Object.keys(methods).length,
      0,
    ),
    v1HttpOperations.reduce(
      (count, operation) => count + operation.method.split("/").length,
      0,
    ),
  );
  for (const operation of v1HttpOperations)
    for (const method of operation.method.split("/")) {
      assert.ok(spec.paths[operation.path]?.[method.toLowerCase()]);
    }
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref") {
        assert.equal(typeof child, "string");
        assert.ok((child as string).startsWith("#/"));
        let target: unknown = spec;
        for (const part of (child as string).slice(2).split("/")) {
          assert.ok(target && typeof target === "object", child);
          target = (target as Record<string, unknown>)[
            part.replaceAll("~1", "/").replaceAll("~0", "~")
          ];
        }
        assert.notEqual(target, undefined, child);
      } else walk(child);
    }
  };
  walk(spec);
});

test("real host HTTP surface preserves auth, runtime validation, payloads and binary boundaries", async () => {
  const directory = mkdtempSync(join(tmpdir(), "a008-http-contract-"));
  const staticDir = join(directory, "static");
  mkdirSync(staticDir);
  writeFileSync(
    join(staticDir, "index.html"),
    "<!doctype html><title>synthetic client</title>",
  );
  const knowledge = createKnowledgeContext();
  ingest(
    {
      content: "Synthetic contract source.",
      speaker: "user",
      relation: "appears_in",
      locator: "test:contract",
      scope: { verified: true, tags: [] },
    },
    { store: knowledge.evidence },
  );
  let failIngest = false;
  const bridge = (): AcpBridge => ({
    async newSession() {
      return { sessionId: "synthetic-session" };
    },
    async prompt() {},
    cancel() {},
    async closeSession() {},
    async close() {},
    async inspectMemory(query) {
      return inspectKnowledge(
        knowledge,
        { projectId: "synthetic-project", durable: false },
        query,
      );
    },
    async ingestSource() {
      if (failIngest) throw new Error("synthetic extraction failure");
      return {
        artifactId: "synthetic-artifact",
        utteranceIds: [],
        relation: "appears_in",
        speaker: "user",
      };
    },
  });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const secret = "synthetic-contract-provider-key";
  const host = await startGuiHost({
    host: "127.0.0.1",
    port: 0,
    cwd: directory,
    pin: "123456",
    env: { NVIDIA_API_KEY: secret },
    staticDir,
    catalogPath: join(directory, "catalog.json"),
    secretsPath: join(directory, "secrets.json"),
    projectsPath: join(directory, "projects.json"),
    sourceStorePath: join(directory, "sources"),
    createAcpBridge: bridge,
    runTerminal: async (input) => ({
      command: input.command,
      cwd: input.cwd,
      stdout: "synthetic stdout",
      stderr: "",
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
    }),
    fetch: async (input) => {
      const url = String(input);
      if (url === "https://example.test/frame")
        return new Response("", { headers: { "x-frame-options": "DENY" } });
      if (url === "https://integrate.api.nvidia.com/v1/models")
        return Response.json({
          data: [{ id: "nvidia/synthetic", owned_by: "nvidia" }],
        });
      if (url.includes("/data/a008-model-routes.json"))
        return Response.json({
          verifiedAt: "2026-09-21",
          routes: [
            {
              key: "synthetic-zero-route",
              provider: "nvidia",
              modelId: "nvidia/synthetic-zero",
              name: "Synthetic Zero",
              baseUrl: "https://integrate.api.nvidia.com/v1",
              apiStyle: "openai-chat-completions",
              access: "free-endpoint",
              lifecycle: "recurring",
              inputModalities: ["text"],
              capabilities: ["tools"],
              dataPolicy: "review-before-sensitive-use",
              verifiedAt: "2026-09-21",
              sourceUrls: ["https://example.test/zero-cost-source"],
            },
          ],
        });
      if (url === "https://example.test/image")
        return Response.json({
          artifacts: [{ base64: png.toString("base64") }],
        });
      throw new Error(`Unexpected fake provider URL: ${url}`);
    },
  });
  const base = `http://127.0.0.1:${host.port}`;
  let cookie = "";
  const covered = new Set<string>();
  const request = async (
    method: string,
    path: string,
    body?: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        cookie,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(
      response.status,
      status,
      `${method} ${path}: ${await response.clone().text()}`,
    );
    const value: unknown = await response.json();
    assert.equal(
      validateV1HttpResponse(method, path.split("?")[0]!, status, value),
      true,
      `${method} ${path}: ${JSON.stringify(value)}`,
    );
    assert.equal(JSON.stringify(value).includes(secret), false);
    if (status === 200) {
      covered.add(`${method} ${path.split("?")[0]}`);
      const operation = v1HttpOperations.find(
        (op) => op.method === method && op.path === path.split("?")[0],
      );
      if (operation?.body && operation.body !== "binary")
        assert.ok(httpContractSchemas[operation.body].safeParse(body).success);
    }
    return { value, response };
  };
  try {
    for (const operation of v1HttpOperations.filter((op) =>
      op.path.startsWith("/v1/"),
    ))
      await request(operation.method, operation.path, undefined, 401);
    await request("GET", "/health");
    const loginPage = await fetch(base);
    assert.match(await loginPage.text(), /PIN/u);
    await request("POST", "/auth/login", { pin: "000000" }, 401);
    const login = await request("POST", "/auth/login", { pin: "123456" });
    cookie = login.response.headers.get("set-cookie")!.split(";")[0]!;
    assert.match(cookie, /^a008_auth=/u);
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(base + "/index.html", {
        method,
        headers: { cookie },
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type")!, /text\/html/u);
      assert.equal(
        await response.text(),
        method === "HEAD"
          ? ""
          : "<!doctype html><title>synthetic client</title>",
      );
    }
    covered.add("GET/HEAD /{asset}");
    await request("GET", "/v1/models");
    const memory = await request("GET", "/v1/memory?limit=40&offset=0");
    assert.ok(memorySnapshotSchema.safeParse(memory.value).success);
    assert.ok(parseMemorySnapshot(memory.value).summary.total > 0);
    await request("GET", "/v1/memory?limit=1&limit=2", undefined, 400);
    await request("GET", "/v1/memory?unknown=field", undefined, 400);
    await request(
      "GET",
      "/v1/browser/frame-check?url=" +
        encodeURIComponent("https://example.test/frame"),
    );
    await request("GET", "/v1/catalog/kie");
    await request("GET", "/v1/catalog/zero-cost");
    await request("POST", "/v1/catalog/zero-cost");
    await request("POST", "/v1/catalog/zero-cost/models", {
      key: "synthetic-zero-route",
    });
    await request("GET", "/v1/mcp-servers");
    await request("POST", "/v1/mcp-servers", {
      servers: [
        {
          name: "synthetic-mcp",
          command: "synthetic-command",
          args: ["--stdio"],
          env: [{ name: "SYNTHETIC_MODE", value: "test" }],
          enabled: true,
        },
      ],
    });
    await request("POST", "/v1/mcp-servers", { servers: [{ name: "bad" }] }, 400);
    await request("GET", "/v1/catalog/nvidia");
    await request("POST", "/v1/catalog/nvidia", {
      id: "synthetic/model",
      name: false,
      provider: 12,
    });
    await request("DELETE", "/v1/catalog/nvidia?id=synthetic%2Fmodel");
    await request("GET", "/v1/provider-settings");
    await request("POST", "/v1/provider-settings", {
      imageEndpoint: "https://example.test/image",
      nvidiaApiKey: 42,
      chatProvider: "unknown",
    });
    const generated = (
      await request("POST", "/v1/images", {
        prompt: "synthetic image",
        width: "ignored",
        seed: "ignored",
      })
    ).value as GeneratedImage;
    const blob = await fetch(
      `${base}/v1/blobs/${generated.sha256}/${generated.filename}`,
      { headers: { cookie } },
    );
    assert.equal(blob.status, 200);
    assert.equal(blob.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png);
    covered.add("GET /v1/blobs/{sha256}/{name}");
    await request("GET", "/v1/projects");
    await request(
      "GET",
      "/v1/projects/browse?path=" + encodeURIComponent(directory),
    );
    const existingRoot = join(directory, "existing-project");
    mkdirSync(existingRoot);
    writeFileSync(join(existingRoot, "keep.txt"), "unchanged", "utf8");
    const registered = await request("POST", "/v1/projects/register", {
      projectName: "Existing contract fixture",
      rootFolder: existingRoot,
      memory: { useGlobalA008Memory: false },
    });
    assert.equal(
      (registered.value as { rootFolder: string }).rootFolder,
      resolve(existingRoot),
    );
    assert.equal(
      readFileSync(join(existingRoot, "keep.txt"), "utf8"),
      "unchanged",
    );
    const config = {
      projectName: "Contract fixture",
      rootFolder: join(directory, "project"),
    };
    await request("POST", "/v1/projects/preview", config);
    const created = (await request("POST", "/v1/projects/bootstrap", config))
      .value as ProjectCreated;
    await request("POST", "/v1/projects/open", {
      projectId: created.project.projectId,
    });
    await request("POST", "/v1/projects/open", { projectId: "" }, 400);
    await request("POST", "/v1/shell", { command: "synthetic command" });
    await request("POST", "/v1/shell", { command: false }, 400);
    await request("POST", "/v1/shell", { command: "test" }, 415, {
      "content-type": "text/plain",
    });
    await request("GET", "/v1/models", undefined, 403, {
      origin: "https://untrusted.invalid",
    });
    for (const fail of [false, true]) {
      failIngest = fail;
      const response = await fetch(base + "/v1/upload", {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/octet-stream",
          "x-a008-filename": "synthetic.txt",
        },
        body: "synthetic bytes",
      });
      assert.equal(response.status, 200);
      const value: unknown = await response.json();
      assert.ok(validateV1HttpResponse("POST", "/v1/upload", 200, value));
      assert.equal(parseUploadedSource(value).extracted, !fail);
    }
    covered.add("POST /v1/upload");
    assert.deepEqual(
      [...covered].sort(),
      v1HttpOperations.map((op) => `${op.method} ${op.path}`).sort(),
    );
  } finally {
    await host.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
