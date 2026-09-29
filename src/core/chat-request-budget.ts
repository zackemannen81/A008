import { ChatError } from "./errors.js";
import type {
  ChatRequest,
  SerializedChatRequestMeasurement,
} from "./types.js";

export function measureSerializedChatRequest(
  routeId: string,
  serializedBody: string,
): SerializedChatRequestMeasurement {
  if (routeId.trim().length === 0) {
    throw new ChatError("configuration", "Serialized request route identity is empty.");
  }
  const serializedBytes = Buffer.byteLength(serializedBody, "utf8");
  if (!Number.isSafeInteger(serializedBytes) || serializedBytes < 0) {
    throw new ChatError("configuration", "Serialized request size is invalid.");
  }
  return { routeId, serializedBytes };
}

export function measureSelectedChatRequest(
  request: ChatRequest,
  maximumBytes: number,
  measure: ((request: ChatRequest) => SerializedChatRequestMeasurement) | undefined,
  options: {
    readonly allowOverMaximum?: boolean;
    readonly expectedRouteId?: string;
  } = {},
): SerializedChatRequestMeasurement {
  if (
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes < 1 ||
    measure === undefined
  ) {
    throw new ChatError(
      "configuration",
      "Selected provider route has no finite exact serialized-request measurement; continuation fails closed.",
    );
  }
  const result = measure(request);
  if (
    typeof result.routeId !== "string" ||
    result.routeId.trim().length === 0 ||
    !Number.isSafeInteger(result.serializedBytes) ||
    result.serializedBytes < 0 ||
    (options.expectedRouteId !== undefined &&
      result.routeId !== options.expectedRouteId) ||
    (!options.allowOverMaximum && result.serializedBytes > maximumBytes)
  ) {
    throw new ChatError(
      "configuration",
      options.expectedRouteId !== undefined &&
        result.routeId !== options.expectedRouteId
        ? "Selected provider route changed after its continuation budget was bound."
        : "Selected provider route measurement is invalid or exceeds its hard input ceiling.",
    );
  }
  return result;
}
