import assert from "node:assert/strict";
import test from "node:test";
import {
  cookieCredentials,
  DEFAULT_GUI_MODEL,
  type ClientFetch,
} from "../../../packages/client/src/index.js";
import type {
  GuiConversationView,
  PlatformV3Conversation,
  PlatformV3Run,
} from "../../../packages/protocol/src/index.js";
import {
  DurableChatClient,
  type ChatSelection,
} from "./durable-chat-client.js";
import { buildChatTranscript, channelTexts } from "../chat/chat-transcript.js";

const parameters = {
  stream: true,
  temperature: 1,
  topP: 0.95,
  maxTokens: 2048,
  enableThinking: null,
  reasoningBudget: null,
  reasoningEffort: null,
  seed: null,
  stop: null,
};
function conversation(id: string): PlatformV3Conversation {
  return {
    id,
    tenantId: "local",
    projectId: "project",
    workspaceId: `workspace-${id}`,
    title: id,
    createdAt: 1,
    updatedAt: 1,
    revision: 0,
    messages: [],
  };
}
function view(
  chat: PlatformV3Conversation,
  runs: PlatformV3Run[] = [],
): GuiConversationView {
  return {
    conversation: chat,
    runs,
    snapshot: {
      model: DEFAULT_GUI_MODEL,
      parameters,
      messages: chat.messages,
      runtime: {
        cwd: `/worktrees/${chat.id}`,
        projectId: "project",
        memoryPath: "/shared/memory.sqlite",
      },
    },
    workspace: {
      id: chat.workspaceId,
      projectId: "project",
      workspaceMode: "worktree",
      workspacePath: `/worktrees/${chat.id}`,
      branchName: `a008/session-${chat.id}`,
      baseBranch: "main",
      disposition: "active",
      createdAt: "today",
      status: { modifiedFiles: 0, commitsAhead: 0, clean: true },
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  const chats = new Map([
    ["left", conversation("left")],
    ["right", conversation("right")],
  ]);
  const runs: PlatformV3Run[] = [];
  const calls: { path: string; method: string }[] = [];
  let activity: unknown;
  let rejectSubmit = false;
  let holdPermission: ReturnType<typeof deferred<void>> | undefined;
  let holdView: ReturnType<typeof deferred<void>> | undefined;
  let viewStarted = deferred<void>();
  let holdSubmit: ReturnType<typeof deferred<void>> | undefined;
  const submitStarted = deferred<void>();
  const fetch: ClientFetch = async (input, init) => {
    const path = new URL(input).pathname;
    calls.push({ path, method: init?.method ?? "GET" });
    const id = /conversations\/([^/]+)/u.exec(path)?.[1] ?? "left";
    let body: unknown;
    if (path.endsWith("/permission")) {
      if (holdPermission) await holdPermission.promise;
      activity = { thought: "", answer: "", tools: [] };
      return Response.json({ ok: true });
    }
    if (path.endsWith("/activity")) {
      if (activity) return Response.json(activity);
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: "No transient activity after host restart.",
        }),
      };
    }
    if (path.endsWith("/view")) {
      // Capture an old response before it is delivered, to exercise real ordering.
      body = view(
        chats.get(id)!,
        runs.filter((run) => run.conversationId === id),
      );
      if (id === "left" && holdView) {
        viewStarted.resolve();
        await holdView.promise;
      }
    } else if (path.endsWith("/runs") && init?.method === "POST") {
      if (rejectSubmit)
        return Response.json(
          {
            error: {
              code: "REVISION_CONFLICT",
              message: "Synthetic submission conflict",
            },
          },
          { status: 409 },
        );
      const request = JSON.parse(String(init.body));
      const run: PlatformV3Run = {
        id: "run-left",
        tenantId: "local",
        projectId: "project",
        conversationId: id,
        workspaceId: chats.get(id)!.workspaceId,
        principalId: "owner_gui",
        commandId: request.commandId,
        model: request.model,
        status: "running",
        revision: 2,
        createdAt: 1,
        updatedAt: 2,
        leaseGeneration: 1,
        effectStatus: "unknown",
        answerStatus: "pending",
        memoryStatus: "pending",
      };
      runs.push(run);
      const chat = chats.get(id)!;
      chats.set(id, {
        ...chat,
        revision: 1,
        messages: [
          {
            id: "user-left",
            role: "user",
            content: request.text,
            createdAt: 1,
            runId: run.id,
          },
        ],
      });
      body = { run, replayed: false };
      submitStarted.resolve();
      if (holdSubmit) await holdSubmit.promise;
    } else body = { conversation: chats.get(id) };
    return { ok: true, status: 200, statusText: "OK", json: async () => body };
  };
  let saved: ChatSelection | undefined;
  const client = () =>
    new DurableChatClient(
      { fetch, origin: "http://fixture", credentials: cookieCredentials() },
      {
        read: () => saved,
        write: (selection) => {
          saved = selection;
        },
      },
      60_000,
    );
  return {
    chats,
    runs,
    calls,
    client,
    setActivity(value: unknown) {
      activity = value;
    },
    rejectSubmission() {
      rejectSubmit = true;
    },
    submitStarted,
    holdPermission() {
      holdPermission = deferred<void>();
      return holdPermission;
    },
    holdView() {
      holdView = deferred<void>();
      viewStarted = deferred<void>();
      return { ...holdView, started: viewStarted.promise };
    },
    holdSubmit() {
      holdSubmit = deferred<void>();
      return holdSubmit;
    },
  };
}

test("permission decision and concurrent refresh share one request", async () => {
  const f = fixture(),
    client = f.client();
  try {
    await client.selectChat("project", "left");
    await client.prompt("edit");
    f.setActivity({
      thought: "",
      answer: "",
      tools: [],
      permission: { id: "p1", title: "Edit", text: "file" },
    });
    await client.refresh();
    const held = f.holdPermission();
    client.resolveToolPermission("allow_all");
    const refresh = client.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      f.calls.filter((call) => call.path.endsWith("/permission")).length,
      1,
    );
    held.resolve();
    await refresh;
  } finally {
    client.dispose();
  }
});

test("late observation cannot replace the selected chat or cancel its previous run", async () => {
  const f = fixture(),
    client = f.client();
  try {
    await client.selectChat("project", "left");
    const held = f.holdView();
    const oldRead = client.refresh();
    await held.started;
    await client.selectChat("project", "right");
    held.resolve();
    await oldRead;
    assert.equal(client.getSnapshot().sessionId, "right");
    assert.equal(client.getSnapshot().details?.runtime.cwd, "/worktrees/right");
    client.dispose();
    assert.equal(
      f.calls.some((call) => call.method === "POST"),
      false,
    );
    assert.ok(f.calls.every((call) => call.path.startsWith("/v1/chat/v3/")));
  } finally {
    client.dispose();
  }
});

test("accepted and repeated user messages survive stale process snapshots and submission", async () => {
  const f = fixture(),
    client = f.client();
  const old = f.chats.get("left")!;
  const prior = [
    { id: "old-user", role: "user" as const, content: "repeat", createdAt: 1 },
    {
      id: "old-answer",
      role: "assistant" as const,
      content: "prior answer",
      createdAt: 1,
    },
  ];
  f.chats.set("left", { ...old, messages: prior });
  try {
    await client.selectChat("project", "left");
    const hold = f.holdSubmit();
    const pending = client.prompt("repeat");
    await f.submitStarted.promise;
    const channels = () =>
      channelTexts(
        buildChatTranscript({
          session: {
            ...client.getSnapshot(),
            connect: client.connect,
            prompt: client.prompt,
            cancel: client.cancel,
          },
        }).turns,
      );
    assert.deepEqual(channels().user, ["repeat", "repeat"]);
    const accepted = f.chats.get("left")!;
    f.chats.set("left", {
      ...accepted,
      messages: [...prior, ...accepted.messages],
    });
    f.setActivity({
      thought: "thinking",
      answer: "partial",
      tools: [],
      snapshot: view({ ...old, messages: prior }).snapshot,
    });
    hold.resolve();
    await pending;
    assert.equal(client.getSnapshot().pendingText, undefined);
    assert.deepEqual(channels().user, ["repeat", "repeat"]);
    assert.deepEqual(channels().thought, ["thinking"]);
    assert.deepEqual(channels().answer, ["prior answer", "partial"]);
    await client.refresh();
    assert.deepEqual(channels().user, ["repeat", "repeat"]);
  } finally {
    client.dispose();
  }
});

test("failed submission keeps the visible attempted text and does not retry", async () => {
  const f = fixture(),
    client = f.client();
  try {
    await client.selectChat("project", "left");
    f.rejectSubmission();
    await assert.rejects(() => client.prompt("keep this input"));
    assert.equal(client.getSnapshot().pendingText, "keep this input");
    assert.equal(client.getSnapshot().busy, false);
    assert.match(client.getSnapshot().error ?? "", /conflict/);
    await client.refresh();
    assert.equal(client.getSnapshot().pendingText, "keep this input");
    assert.match(client.getSnapshot().error ?? "", /conflict/);
    assert.equal(f.calls.filter((call) => call.method === "POST").length, 1);
    await client.selectChat("project", "right");
    assert.equal(client.getSnapshot().pendingText, undefined);
  } finally {
    client.dispose();
  }
});

test("disconnect during submission makes one attempt; another normal client reads the committed completion", async () => {
  const f = fixture(),
    first = f.client(),
    observer = f.client();
  try {
    await first.selectChat("project", "left");
    const held = f.holdSubmit();
    const submit = first.prompt("continue without this browser");
    await f.submitStarted.promise;
    assert.equal(
      first.getSnapshot().pendingText,
      "continue without this browser",
    );
    first.dispose();
    held.resolve();
    await submit;
    const run = f.runs[0]!;
    f.runs[0] = {
      ...run,
      status: "succeeded",
      revision: 3,
      answerStatus: "completed",
      memoryStatus: "completed",
      effectStatus: "known",
    };
    const chat = f.chats.get("left")!;
    f.chats.set("left", {
      ...chat,
      revision: 2,
      messages: [
        ...chat.messages,
        {
          id: "answer-left",
          role: "assistant",
          content: "completed by host",
          createdAt: 2,
          runId: run.id,
        },
      ],
    });
    await observer.selectChat("project", "left");
    assert.equal(
      observer.getSnapshot().details?.messages.at(-1)?.content,
      "completed by host",
    );
    assert.equal(observer.getSnapshot().busy, false);
    assert.deepEqual(
      f.calls.filter((call) => call.method === "POST").map((call) => call.path),
      ["/v1/chat/v3/conversations/left/runs"],
    );
  } finally {
    first.dispose();
    observer.dispose();
  }
});
