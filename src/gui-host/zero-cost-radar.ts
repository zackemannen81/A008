import {
  zeroCostCatalogSchema,
  type ZeroCostCatalog,
} from "../../packages/protocol/src/index.js";
import { ChatError } from "../core/errors.js";

export const ZERO_COST_RADAR_FEED_URL =
  "https://zerocostradar.netlify.app/data/a008-model-routes.json";

export async function fetchLatestZeroCostCatalog(
  fetchImpl: typeof fetch,
): Promise<ZeroCostCatalog> {
  let response: Response;
  try {
    response = await fetchImpl(ZERO_COST_RADAR_FEED_URL, {
      headers: { accept: "application/json" },
    });
  } catch (cause) {
    throw new ChatError(
      "network",
      "Zero Cost Radar update check could not reach the published feed.",
      { cause, retryable: true },
    );
  }

  if (!response.ok) {
    throw new ChatError(
      "provider",
      `Zero Cost Radar update check failed (HTTP ${String(response.status)}).`,
      { status: response.status, retryable: response.status >= 500 },
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new ChatError(
      "invalid_response",
      "Zero Cost Radar returned invalid JSON.",
      { cause },
    );
  }

  const parsed = zeroCostCatalogSchema.safeParse(body);
  if (!parsed.success) {
    throw new ChatError(
      "invalid_response",
      "Zero Cost Radar returned incompatible model-route metadata.",
    );
  }

  if (
    parsed.data.routes.some(
      (route) => route.verifiedAt !== parsed.data.verifiedAt,
    )
  ) {
    throw new ChatError(
      "invalid_response",
      "Zero Cost Radar returned inconsistent verification dates.",
    );
  }

  return parsed.data;
}
