import assert from "node:assert/strict";
import test from "node:test";
import {
  FAKE_NVIDIA_REPLY_TOKEN,
  startFakeNvidiaServer,
  type FakeNvidiaRequestEvidence,
} from "./fixtures/fake-nvidia-server.js";

test("fake NVIDIA runtime server is loopback-only and emits deterministic SSE", async () => {
  let evidence: FakeNvidiaRequestEvidence | undefined;
  const server = await startFakeNvidiaServer({
    expectedApiKey: "fixture-key",
    onRequest: (received) => {
      evidence = received;
    },
  });

  try {
    assert.match(server.endpoint, /^http:\/\/127\.0\.0\.1:\d+\//);
    const response = await fetch(server.endpoint, {
      method: "POST",
      headers: {
        authorization: "Bearer fixture-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3.5-lightning-30b-a3b",
        messages: [{ role: "user", content: "Canvas proof" }],
        stream: true,
      }),
    });

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^text\/event-stream/,
    );
    const body = await response.text();
    assert.match(body, new RegExp(FAKE_NVIDIA_REPLY_TOKEN));
    assert.match(body, /\[DONE\]/);
    assert.deepEqual(evidence, {
      authorizationAccepted: true,
      messageCount: 1,
      method: "POST",
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
      path: "/v1/chat/completions",
      userMessage: "Canvas proof",
    });
  } finally {
    await server.close();
  }
});

test("fake NVIDIA runtime server rejects an unexpected test key", async () => {
  const server = await startFakeNvidiaServer({ expectedApiKey: "fixture-key" });
  try {
    const response = await fetch(server.endpoint, {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-key",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(response.status, 401);
  } finally {
    await server.close();
  }
});
