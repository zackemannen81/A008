import assert from "node:assert/strict";
import test from "node:test";
import type { V2Info } from "../../../packages/protocol/src/index.js";
import {
  loadRuntimeCapabilities,
  STAGE4_COMMAND_FEATURES,
  STAGE4_FOUNDATION_FEATURES,
  STAGE4_RECOVERY_FEATURES,
  STAGE4_REMAINING,
  stage4FoundationComplete,
} from "./runtime-capabilities.js";

const info: V2Info = {
  protocol: "a008.v2",
  serverInstanceId: "server_fixture",
  serverVersion: "0.0.0",
  authProfiles: ["device"],
  features: [
    ...STAGE4_FOUNDATION_FEATURES,
    ...STAGE4_COMMAND_FEATURES,
    ...STAGE4_RECOVERY_FEATURES,
    "auth.tickets",
    "session.websocket",
  ],
  limits: {
    ticketLifetimeMs: 30000,
    preauthFrameBytes: 4096,
    authenticationDeadlineMs: 5000,
    inputFrameBytes: 1048576,
    outputFrameBytes: 8388608,
    promptBytes: 65536,
    sessionResumeLeaseMs: 45000,
    commandReceiptRetentionMs: 300000,
    commandReceiptLimitPerPrincipal: 1024,
  },
} as const;

test("runtime discovery recognizes the Stage 4 foundation", async () => {
  const loaded = await loadRuntimeCapabilities(
    undefined,
    async () =>
      new Response(JSON.stringify(info), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  assert.equal(stage4FoundationComplete(loaded), true);
});

test("Stage 4 foundation requires every advertised foundation feature", () => {
  assert.equal(
    stage4FoundationComplete({ ...info, features: ["session.turn-identity"] }),
    false,
  );
});
