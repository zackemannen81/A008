import {
  cookieCredentials,
  type CredentialAdapter,
} from "../../../packages/client/src/index.js";
import type {
  ChatContent,
  PlatformV3RunStatus,
} from "../../../packages/protocol/src/index.js";

/**
 * PIN cookies authorize the browser principal. An engine bearer is not a
 * device credential and is not app auth.
 */
export function platformResourceCredentials(
  authProfiles: readonly string[],
  configured: CredentialAdapter,
): CredentialAdapter | undefined {
  if (authProfiles.includes("browser-pin")) return cookieCredentials();
  if (configured.kind === "bearer") return configured;
  return undefined;
}

/** Text status. `succeeded` is shown as completed; color is not the signal. */
export function platformRunStatusText(status: PlatformV3RunStatus): string {
  if (status === "succeeded") return "completed";
  return status;
}

export function platformMessageText(content: ChatContent): string {
  if (typeof content === "string") return content;
  const text = content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  return text.length > 0 ? text : "Unsupported message content";
}
