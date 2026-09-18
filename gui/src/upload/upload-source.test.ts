import assert from "node:assert/strict";
import test from "node:test";
import {
  UPLOAD_ENDPOINT,
  UploadError,
  uploadSource,
  uploadSourcePath,
  type UploadableFile,
} from "./upload-source.js";

interface FetchCall {
  readonly input: string;
  readonly method: string | undefined;
  readonly credentials: RequestCredentials | undefined;
  readonly headers: Record<string, string>;
  readonly bodyBytes: Uint8Array | undefined;
}

function headerRecord(
  headers: HeadersInit | undefined,
): Record<string, string> {
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

function fakeHost(handler: (call: FetchCall) => Response | Promise<Response>): {
  readonly fetch: typeof fetch;
  readonly calls: FetchCall[];
} {
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

function uploadedSource(
  overrides: Partial<{
    locator: string;
    sha256: string;
    bytes: number;
    mediaType: string;
    extracted: boolean;
    artifactId: string;
  }> = {},
) {
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

test("posts raw bytes with the octet-stream content type and filename header", async () => {
  const host = fakeHost(() => jsonResponse(uploadedSource()));
  const result = await uploadSource(fakeFile("report.txt", "hello world"), {
    fetch: host.fetch,
  });

  assert.equal(host.calls.length, 1);
  const call = host.calls[0];
  assert.ok(call);
  assert.equal(call.input, UPLOAD_ENDPOINT);
  assert.equal(call.method, "POST");
  assert.equal(call.credentials, "same-origin");
  assert.equal(call.headers["content-type"], "application/octet-stream");
  assert.equal(
    call.headers["x-a008-filename"],
    encodeURIComponent("report.txt"),
  );
  assert.ok(call.bodyBytes);
  assert.equal(
    new TextDecoder().decode(call.bodyBytes),
    "hello world",
    "raw file bytes forwarded, unmodified",
  );

  assert.equal(result.locator, "source:deadbeef/report.txt");
  assert.equal(result.mediaType, "text/plain");
  assert.equal(result.extracted, true);
  assert.equal(result.artifactId, "artifact-1");
});

test("percent-encodes a filename with non-Latin1 characters", async () => {
  const host = fakeHost(() => jsonResponse(uploadedSource()));
  await uploadSource(fakeFile("résumé 简历 🙂.txt", "x"), {
    fetch: host.fetch,
  });

  const call = host.calls[0];
  assert.ok(call);
  assert.equal(
    call.headers["x-a008-filename"],
    encodeURIComponent("résumé 简历 🙂.txt"),
  );
});

test("reflects extracted: false and no artifactId on success", async () => {
  const host = fakeHost(() =>
    jsonResponse(
      uploadedSource({
        extracted: false,
        artifactId: undefined,
        mediaType: "image/png",
      }),
    ),
  );
  const result = await uploadSource(fakeFile("photo.png", "x"), {
    fetch: host.fetch,
  });

  assert.equal(result.extracted, false);
  assert.equal(result.artifactId, undefined);
});

test("surfaces the server's named reason for an unsupported media type", async () => {
  const host = fakeHost(() =>
    jsonResponse(
      { message: "Unsupported media type: application/pdf" },
      415,
      "Unsupported Media Type",
    ),
  );

  // The named reason is the point: an unreadable upload must say which type
  // A008 cannot read, never a generic failure.
  await assert.rejects(
    () => uploadSource(fakeFile("report.pdf", "x"), { fetch: host.fetch }),
    (error: unknown) =>
      error instanceof UploadError &&
      error.message ===
        "A008 GUI host upload failed (415): Unsupported media type: application/pdf",
  );
});

test("reports an oversized file as such instead of hanging", async () => {
  const host = fakeHost(() =>
    jsonResponse(
      { message: "Upload exceeds the 25 MB limit." },
      413,
      "Payload Too Large",
    ),
  );

  await assert.rejects(
    () => uploadSource(fakeFile("huge.bin", "x"), { fetch: host.fetch }),
    (error: unknown) =>
      error instanceof UploadError &&
      error.message ===
        "A008 GUI host upload failed (413): Upload exceeds the 25 MB limit.",
  );
});

test("maps a network failure without hanging", async () => {
  const host = fakeHost(() => {
    throw new TypeError("Failed to fetch");
  });

  await assert.rejects(
    () => uploadSource(fakeFile("report.txt", "x"), { fetch: host.fetch }),
    (error: unknown) =>
      error instanceof UploadError &&
      error.message === "Failed to reach the A008 GUI host upload route." &&
      error.cause instanceof TypeError,
  );
});

test("rejects a nameless file without fetching", async () => {
  const host = fakeHost(() => jsonResponse(uploadedSource()));

  await assert.rejects(
    () => uploadSource(fakeFile("   ", "x"), { fetch: host.fetch }),
    (error: unknown) =>
      error instanceof UploadError &&
      error.message === "Select a file to upload.",
  );
  assert.equal(host.calls.length, 0, "refused before reaching the network");
});

test("rejects malformed host JSON on a 2xx response", async () => {
  const host = fakeHost(() =>
    jsonResponse({ locator: "l", bytes: "not-a-number" }),
  );

  await assert.rejects(
    () => uploadSource(fakeFile("report.txt", "x"), { fetch: host.fetch }),
    (error: unknown) =>
      error instanceof UploadError &&
      error.message ===
        "A008 GUI host upload result field 'sha256' must be a non-empty string.",
  );
});

test("sends only the documented headers, no credential", async () => {
  const host = fakeHost(() => jsonResponse(uploadedSource()));
  await uploadSource(fakeFile("report.txt", "hi"), { fetch: host.fetch });

  const call = host.calls[0];
  assert.ok(call);
  assert.equal(
    Object.keys(call.headers).sort().join(","),
    "accept,content-type,x-a008-filename",
  );
  assert.equal(call.headers["authorization"], undefined);
});

test("local path import uses the existing upload endpoint without renderer file bytes", async () => {
  const host = fakeHost(() =>
    jsonResponse(
      uploadedSource({
        locator: "source:deadbeef/photo.png",
        mediaType: "image/png",
      }),
    ),
  );
  const result = await uploadSourcePath("C:\\shots\\photo.png", {
    fetch: host.fetch,
  });

  assert.equal(result.mediaType, "image/png");
  assert.equal(host.calls.length, 1);
  const call = host.calls[0];
  assert.ok(call);
  assert.equal(call.input, UPLOAD_ENDPOINT);
  assert.equal(call.method, "POST");
  assert.equal(call.credentials, "same-origin");
  assert.equal(call.headers["content-type"], "application/octet-stream");
  assert.equal(
    call.headers["x-a008-local-path"],
    encodeURIComponent("C:\\shots\\photo.png"),
  );
  assert.equal(call.headers["x-a008-filename"], undefined);
  assert.equal(call.bodyBytes, undefined);
});

test("local path import refuses an empty path before fetching", async () => {
  const host = fakeHost(() => jsonResponse(uploadedSource()));

  await assert.rejects(
    () => uploadSourcePath("   ", { fetch: host.fetch }),
    (error: unknown) =>
      error instanceof UploadError &&
      error.message === "Enter an absolute local file path.",
  );
  assert.equal(host.calls.length, 0);
});

test("local path import surfaces the host path validation reason", async () => {
  const host = fakeHost(() =>
    jsonResponse(
      { message: "Local upload path must be an absolute file path." },
      400,
      "Bad Request",
    ),
  );

  await assert.rejects(
    () => uploadSourcePath("relative.png", { fetch: host.fetch }),
    (error: unknown) =>
      error instanceof UploadError &&
      error.message ===
        "A008 GUI host upload failed (400): Local upload path must be an absolute file path.",
  );
});
