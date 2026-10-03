import assert from "node:assert/strict";
import test from "node:test";
import {
  notificationMessage,
  playOutcomeTone,
  RunOutcomeTracker,
  startTitleAttention,
  type AttentionScheduler,
} from "./run-notifications.js";

function fakeScheduler() {
  const intervals = new Map<number, () => void>();
  const timeouts = new Map<number, () => void>();
  let nextId = 0;
  const scheduler: AttentionScheduler = {
    setInterval(callback) {
      const id = ++nextId;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(handle) { intervals.delete(handle as number); },
    setTimeout(callback) {
      const id = ++nextId;
      timeouts.set(id, callback);
      return id;
    },
    clearTimeout(handle) { timeouts.delete(handle as number); },
  };
  return { scheduler, intervals, timeouts };
}

test("run outcome tracker emits one terminal edge for active run identities", () => {
  const tracker = new RunOutcomeTracker();
  assert.equal(tracker.observe({ id: "already-done", status: "succeeded" }), undefined);
  assert.equal(tracker.observe({ id: "run-1", status: "running" }), undefined);
  assert.equal(tracker.observe({ id: "run-1", status: "running" }), undefined);
  assert.equal(tracker.observe({ id: "run-1", status: "succeeded" }), "succeeded");
  assert.equal(tracker.observe({ id: "run-1", status: "succeeded" }), undefined);
  assert.equal(tracker.observe({ id: "run-2", status: "failed" }), undefined);
  assert.equal(tracker.observe({ id: "run-3", status: "queued" }), undefined);
  assert.equal(tracker.observe({ id: "run-3", status: "needs_reconciliation" }), "uncertain");
  assert.equal(tracker.observe({ id: "run-3", status: "needs_reconciliation" }), undefined);
  assert.equal(tracker.observe({ id: "run-4", status: "running" }), undefined);
  assert.equal(tracker.observe({ id: "run-4", status: "failed" }), "failed");
});

test("title attention blinks, then restores on focus or bounded timeout", () => {
  const { scheduler, intervals, timeouts } = fakeScheduler();
  const windowListeners = new Map<string, () => void>();
  const documentListeners = new Map<string, () => void>();
  const document = {
    title: "A008",
    visibilityState: "hidden",
    addEventListener: (type: string, listener: () => void) => documentListeners.set(type, listener),
    removeEventListener: (type: string) => documentListeners.delete(type),
  };
  const window = {
    addEventListener: (type: string, listener: () => void) => windowListeners.set(type, listener),
    removeEventListener: (type: string) => windowListeners.delete(type),
  };
  const stop = startTitleAttention(document, window, "failed", scheduler);
  const blink = [...intervals.values()][0];
  assert.ok(blink);
  blink();
  assert.match(document.title, /misslyckades/u);
  windowListeners.get("focus")?.();
  assert.equal(document.title, "A008");
  assert.equal(intervals.size, 0);
  assert.equal(timeouts.size, 0);
  stop();

  const stopOnVisibility = startTitleAttention(document, window, "succeeded", scheduler);
  document.visibilityState = "visible";
  documentListeners.get("visibilitychange")?.();
  assert.equal(document.title, "A008");
  stopOnVisibility();

  const stopOnTimeout = startTitleAttention(document, window, "uncertain", scheduler, 10);
  const timeout = [...timeouts.values()][0];
  assert.ok(timeout);
  timeout();
  assert.equal(document.title, "A008");
  stopOnTimeout();
});

test("outcome tone is opt-in and playback failure is non-fatal", async () => {
  let created = 0;
  await playOutcomeTone(false, "succeeded", () => {
    created += 1;
    throw new Error("must not create an AudioContext while disabled");
  });
  assert.equal(created, 0);
  await playOutcomeTone(true, "failed", () => {
    created += 1;
    return { currentTime: 0, destination: {}, resume: async () => { throw new Error("autoplay blocked"); }, createOscillator: () => { throw new Error("unreachable"); }, createGain: () => { throw new Error("unreachable"); } };
  });
  assert.equal(created, 1);
  assert.equal(notificationMessage("succeeded"), "Turn klar.");
  assert.match(notificationMessage("uncertain"), /osäkert/u);
});
