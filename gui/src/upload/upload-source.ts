import {
  UploadError,
  parseUploadedSource,
  type UploadedSource,
} from "../../../packages/protocol/src/index.js";
export {
  UploadError,
  type UploadedSource,
} from "../../../packages/protocol/src/index.js";
import { engineHeaders } from "../session/engine-access.js";
/** Host protocol v1 upload endpoint (ADR 0020 D3). */
export const UPLOAD_ENDPOINT = "/v1/upload";

/**
 * Result of a successful `POST /v1/upload`, exactly as ADR 0020 D3 defines
 * it. `extracted` is a plain boolean; the contract carries no separate
 * reason field for the "not extracted" case on a 2xx response. A failed
 * request (unsupported media type, oversized file, ...) is instead reported
 * as a rejected promise carrying the host's named reason — see
 * `UploadError` and `failureMessage` below.
 */
/** Anything with a `File`-shaped name and body the client can read once. */
export interface UploadableFile {
  readonly name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface UploadSourceOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly endpoint?: string;
}

/**
 * POST raw file bytes to `/v1/upload` on the A008 GUI host (ADR 0020 D3):
 * `content-type: application/octet-stream`, `x-a008-filename: <name>`, body
 * is the untouched bytes. The declared name is advisory on the host side
 * (`src/ingest/types.ts`), so it is percent-encoded here to keep the header
 * value a legal ByteString for any filename a user picks (accents, CJK,
 * emoji, ...); the host decodes it, or displays it encoded, and never uses
 * it to decide the media type either way.
 *
 * Does not read, parse, or preview the file content beyond the single
 * `arrayBuffer()` read needed to send the bytes, and makes no provider call.
 */
export async function uploadSource(
  file: UploadableFile,
  options: UploadSourceOptions = {},
): Promise<UploadedSource> {
  const filename = file.name.trim();
  if (filename.length === 0) {
    throw new UploadError("Select a file to upload.");
  }

  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new UploadError(
      "fetch is not available to reach the A008 GUI host upload route.",
    );
  }

  const endpoint = options.endpoint ?? UPLOAD_ENDPOINT;

  let body: ArrayBuffer;
  try {
    body = await file.arrayBuffer();
  } catch (cause) {
    throw new UploadError("Could not read the selected file.", { cause });
  }

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        ...engineHeaders(),
        accept: "application/json",
        "content-type": "application/octet-stream",
        "x-a008-filename": encodeURIComponent(filename),
      },
      body,
    });
  } catch (cause) {
    throw new UploadError("Failed to reach the A008 GUI host upload route.", {
      cause,
    });
  }

  if (!response.ok) {
    throw new UploadError(await failureMessage(response));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new UploadError("A008 GUI host upload route returned non-JSON.", {
      cause,
    });
  }

  return parseUploadedSource(payload);
}

/**
 * Reads the host's JSON error body and surfaces its `message` field, so an
 * unsupported media type or an oversized file shows the server's named
 * reason instead of a generic "upload failed" (ADR 0020 D3/D5, definition
 * of done). Falls back to the HTTP status line when the body is missing or
 * not JSON.
 */
async function failureMessage(response: Response): Promise<string> {
  const prefix = `A008 GUI host upload failed (${response.status})`;
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && typeof payload.message === "string") {
      const message = payload.message.trim();
      if (message.length > 0) {
        return `${prefix}: ${message}`;
      }
    }
  } catch {
    // Host may return an empty or non-JSON error body.
  }
  const statusText = response.statusText.trim();
  return statusText.length > 0 ? `${prefix}: ${statusText}` : `${prefix}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
