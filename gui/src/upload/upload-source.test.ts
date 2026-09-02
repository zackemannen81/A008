import {
  UPLOAD_ENDPOINT,
  UploadError,
  uploadSource,
  type UploadableFile,
} from "./upload-source.js";

interface FetchCall {
  readonly input: string;
  readonly method: string | undefined;
  readonly credentials: RequestCredentials | undefined;
  readonly headers: Record<string, string>;
  readonly bodyBytes: Uint8Array | undefined;
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (headers === undefined) {
    return out;
  }
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      out[key.toLowerCase()] = value;
    }
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function bodyBytes(body: BodyInit | null | undefined): Uint8Array | undefined {
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  return undefined;
}

function jsonResponse(body: unknown, status = 200, statusText = ""): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "content-type": "application/json" },
  });
}

function fakeHost(
  handler: (call: FetchCall) => Response | Promise<Response>,
): { readonly fetch: typeof fetch; readonly calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const call: FetchCall = {
      input: requestUrl(input),
      method: init?.method,
      credentials: init?.credentials,
      headers: headerRecord(init?.headers),
      bodyBytes: bodyBytes(init?.body),
    };
    calls.push(call);
    return await handler(call);
  };
  return { fetch: fetchImpl, calls };
}

function fakeFile(name: string, contents: string): UploadableFile {
  const bytes = new TextEncoder().encode(contents);
  return {
    name,
    async arrayBuffer(): Promise<ArrayBuffer> {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    },
  };
}

function uploadedSource(overrides: Partial<{
  locator: string;
  sha256: string;
  bytes: number;
  mediaType: string;
  extracted: boolean;
  artifactId: string;
}> = {}) {
  return {
    locator: "source:deadbeef/report.txt",
    sha256: "deadbeef",
    bytes: 11,
    mediaType: "text/plain",
    extracted: true,
    artifactId: "artifact-1",
    ...overrides,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  check: (error: unknown) => boolean,
  message: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (!check(error)) {
      throw new Error(`${message}: rejected with unexpected value ${String(error)}`);
    }
    return;
  }
  throw new Error(`${message}: expected rejection`);
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

export async function runUploadModuleTests(): Promise<void> {
  await runCase(
    "posts raw bytes with the octet-stream content type and filename header",
    async () => {
      const host = fakeHost(() => jsonResponse(uploadedSource()));
      const file = fakeFile("report.txt", "hello world");
      const result = await uploadSource(file, { fetch: host.fetch });

      assertEqual(host.calls.length, 1, "one fetch");
      const call = host.calls[0];
      assert(call !== undefined, "recorded call");
      assertEqual(call.input, UPLOAD_ENDPOINT, "endpoint");
      assertEqual(call.method, "POST", "method");
      assertEqual(call.credentials, "omit", "credentials omitted");
      assertEqual(
        call.headers["content-type"],
        "application/octet-stream",
        "octet-stream content-type",
      );
      assertEqual(
        call.headers["x-a008-filename"],
        encodeURIComponent("report.txt"),
        "filename header",
      );
      assert(call.bodyBytes !== undefined, "body bytes sent");
      assertEqual(
        new TextDecoder().decode(call.bodyBytes),
        "hello world",
        "raw file bytes forwarded, unmodified",
      );

      assertEqual(result.locator, "source:deadbeef/report.txt", "locator");
      assertEqual(result.mediaType, "text/plain", "mediaType");
      assertEqual(result.extracted, true, "extracted");
      assertEqual(result.artifactId, "artifact-1", "artifactId");
    },
  );

  await runCase("percent-encodes a filename with non-Latin1 characters", async () => {
    const host = fakeHost(() => jsonResponse(uploadedSource()));
    const file = fakeFile("résumé 简历 🙂.txt", "x");
    await uploadSource(file, { fetch: host.fetch });
    const call = host.calls[0];
    assert(call !== undefined, "recorded call");
    assertEqual(
      call.headers["x-a008-filename"],
      encodeURIComponent("résumé 简历 🙂.txt"),
      "percent-encoded filename header",
    );
  });

  await runCase("reflects extracted: false and no artifactId on success", async () => {
    const host = fakeHost(() =>
      jsonResponse(
        uploadedSource({ extracted: false, artifactId: undefined, mediaType: "image/png" }),
      ),
    );
    const result = await uploadSource(fakeFile("photo.png", "x"), {
      fetch: host.fetch,
    });
    assertEqual(result.extracted, false, "not extracted");
    assertEqual(result.artifactId, undefined, "no artifact id");
  });

  await runCase(
    "surfaces the server's named reason for an unsupported media type",
    async () => {
      const host = fakeHost(() =>
        jsonResponse(
          { message: "Unsupported media type: application/pdf" },
          415,
          "Unsupported Media Type",
        ),
      );
      await assertRejects(
        () => uploadSource(fakeFile("report.pdf", "x"), { fetch: host.fetch }),
        (error) =>
          error instanceof UploadError &&
          error.message ===
            "A008 GUI host upload failed (415): Unsupported media type: application/pdf",
        "unsupported media type",
      );
    },
  );

  await runCase("reports an oversized file as such instead of hanging", async () => {
    const host = fakeHost(() =>
      jsonResponse(
        { message: "Upload exceeds the 25 MB limit." },
        413,
        "Payload Too Large",
      ),
    );
    await assertRejects(
      () => uploadSource(fakeFile("huge.bin", "x"), { fetch: host.fetch }),
      (error) =>
        error instanceof UploadError &&
        error.message ===
          "A008 GUI host upload failed (413): Upload exceeds the 25 MB limit.",
      "oversized file",
    );
  });

  await runCase("maps a network failure without hanging", async () => {
    const host = fakeHost(() => {
      throw new TypeError("Failed to fetch");
    });
    await assertRejects(
      () => uploadSource(fakeFile("report.txt", "x"), { fetch: host.fetch }),
      (error) =>
        error instanceof UploadError &&
        error.message === "Failed to reach the A008 GUI host upload route." &&
        error.cause instanceof TypeError,
      "network error",
    );
  });

  await runCase("rejects a nameless file without fetching", async () => {
    const host = fakeHost(() => jsonResponse(uploadedSource()));
    await assertRejects(
      () => uploadSource(fakeFile("   ", "x"), { fetch: host.fetch }),
      (error) =>
        error instanceof UploadError &&
        error.message === "Select a file to upload.",
      "empty filename",
    );
    assertEqual(host.calls.length, 0, "no fetch");
  });

  await runCase("rejects malformed host JSON on a 2xx response", async () => {
    await assertRejects(
      () =>
        uploadSource(fakeFile("report.txt", "x"), {
          fetch: fakeHost(() => jsonResponse({ locator: "l", bytes: "not-a-number" }))
            .fetch,
        }),
      (error) =>
        error instanceof UploadError &&
        error.message ===
          "A008 GUI host upload result field 'sha256' must be a non-empty string.",
      "malformed result",
    );
  });

  await runCase("sends only the documented headers, no credential", async () => {
    const host = fakeHost(() => jsonResponse(uploadedSource()));
    await uploadSource(fakeFile("report.txt", "hi"), { fetch: host.fetch });
    const call = host.calls[0];
    assert(call !== undefined, "recorded call");
    assertEqual(
      Object.keys(call.headers).sort().join(","),
      "accept,content-type,x-a008-filename",
      "only the documented request headers are present",
    );
    assert(call.headers["authorization"] === undefined, "no authorization header");
  });

  console.log("9 passed");
}

function isDirectNodeRun(): boolean {
  const proc = (globalThis as { process?: { argv?: string[] } }).process;
  const argv1 = proc?.argv?.[1];
  if (typeof argv1 !== "string" || argv1.length === 0) {
    return false;
  }
  const normalized = argv1.replaceAll("\\", "/");
  return (
    normalized.endsWith("/upload-source.test.js") ||
    normalized.endsWith("/upload-source.test.ts")
  );
}

if (isDirectNodeRun()) {
  void runUploadModuleTests().then(
    () => undefined,
    (error: unknown) => {
      console.error(error);
      const proc = (globalThis as { process?: { exit?: (code: number) => void } })
        .process;
      proc?.exit?.(1);
    },
  );
}
