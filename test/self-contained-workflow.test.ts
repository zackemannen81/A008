import assert from "node:assert/strict";
import test from "node:test";
import { ChatSession } from "../src/core/chat-session.js";
import {
  renderTaskWorkflow,
  applyWorkflowProgress,
  validateTaskWorkflow,
  WORKFLOW_PROGRESS_TOOL,
} from "../src/core/task-workflow.js";
import {
  validateContinuationRecovery,
  type RunContinuationCheckpointWrite,
  type RunContinuationRecovery,
  type RunToolInteraction,
} from "../src/core/chat-continuation.js";
import { SELECT_TOOLS } from "../src/core/runtime-tool-context.js";
import type { ChatRequest } from "../src/core/types.js";

const context = {
  maximumRequestBytes: 200_000,
  maximumStateBytes: 40_000,
  reducerInputBytes: 200_000,
  reducerOutputTokens: 4096,
  workflowEnabled: true,
};
const definitions = [
  {
    name: "read_file",
    description: "Read one project file",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
];
const plan = {
  description: "Write a GDD after checking project requirements",
  checklist: [
    { id: "inspect", task: "Inspect relevant project instructions" },
    { id: "draft", task: "Create game design document" },
    { id: "verify", task: "Verify output" },
  ],
  nextAction: "Read docs/CURRENT_TASK.md to establish the project constraints.",
};

const sampleRead: RunToolInteraction = {
  id: "abc:1",
  messages: [
    {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "call_read",
          name: "read_file",
          arguments: '{"path":"docs/CURRENT_TASK.md"}',
        },
      ],
    },
    {
      role: "tool",
      toolCallId: "call_read",
      content: JSON.stringify({
        status: "completed",
        text: "The project task is a draft.",
      }),
    },
  ],
};

test("workflow data is chronological and never relies on unseen older context", () => {
  const workflow = validateTaskWorkflow(plan);
  const state = {
    version: "a008_run_continuation_state_v1" as const,
    runId: "abc",
    verifiedFacts: [],
    hypotheses: [],
    completedActions: [
      {
        id: "second",
        statement: "Read file two and found a constraint",
        sourceRefs: ["abc:2"],
      },
      {
        id: "first",
        statement: "Read file one and found the baseline",
        sourceRefs: ["abc:1"],
      },
    ],
  };
  const rendered = JSON.parse(
    renderTaskWorkflow({
      objective: "Prepare GDD",
      workflow,
      state,
      recent: [],
    }),
  );
  assert.deepEqual(
    rendered.completedWorkChronological.map(
      (x: { findingOrResult: string }) => x.findingOrResult,
    ),
    [
      "Read file one and found the baseline",
      "Read file two and found a constraint",
    ],
  );
  assert.equal(rendered.originalRequest, "Prepare GDD");
  assert.equal(
    rendered.checklist.every((x: { checked: boolean }) => !x.checked),
    true,
  );
  assert.equal(rendered.nextAction, plan.nextAction);
});

test("checklist completion requires successful saved tool evidence", () => {
  const workflow = validateTaskWorkflow(plan);
  const good = applyWorkflowProgress(
    workflow,
    {
      completed: [{ id: "inspect", sourceRefs: ["abc:1"] }],
      nextAction: "Draft the GDD",
    },
    [sampleRead],
  );
  assert.equal(good.workflow.checklist[0]?.done, true);
  assert.equal(good.workflow.nextAction, "Draft the GDD");
  const bad = applyWorkflowProgress(
    workflow,
    {
      completed: [{ id: "verify", sourceRefs: ["abc:missing"] }],
      nextAction: "Finish",
    },
    [sampleRead],
  );
  assert.equal(bad.workflow.checklist[2]?.done, false);
  assert.match(bad.result, /failed/);
  const failedRead = {
    ...sampleRead,
    messages: [
      sampleRead.messages[0]!,
      {
        role: "tool" as const,
        toolCallId: "call_read",
        content: '{"status":"failed"}',
      },
    ],
  };
  assert.match(
    applyWorkflowProgress(
      workflow,
      {
        completed: [{ id: "inspect", sourceRefs: ["abc:1"] }],
        nextAction: "Next",
      },
      [failedRead],
    ).result,
    /failed/,
  );
});

test("initial planning, one successful read and evidence-backed status persist in every new prompt", async () => {
  let planning = 0,
    effects = 0,
    rounds = 0;
  const observed: ReturnType<typeof JSON.parse>[] = [];
  const session = new ChatSession({
    model: "fixture",
    systemMessage: "Follow the user's requests.",
    transport: {
      async complete(request: ChatRequest) {
        if (!request.tools) {
          planning++;
          assert.equal(request.outputSchema?.name, "a008_initial_workflow");
          return {
            message: {
              role: "assistant" as const,
              content: JSON.stringify(plan),
            },
          };
        }
        const document = JSON.parse(
          request.messages.at(-1)!.content.split("\n").slice(1).join("\n"),
        );
        observed.push(document);
        rounds++;
        if (rounds === 1)
          return {
            message: { role: "assistant" as const, content: "" },
            toolCalls: [
              {
                id: "select",
                name: SELECT_TOOLS,
                arguments: '{"names":["read_file"]}',
              },
            ],
          };
        if (rounds === 2)
          return {
            message: { role: "assistant" as const, content: "" },
            toolCalls: [
              {
                id: "read",
                name: "read_file",
                arguments: '{"path":"docs/CURRENT_TASK.md"}',
              },
            ],
          };
        if (rounds === 3) {
          const source = document.recentUnreducedToolRounds.find(
            (x: { tools: { name: string }[] }) =>
              x.tools.some((t) => t.name === "read_file"),
          ).sourceRef;
          return {
            message: { role: "assistant" as const, content: "" },
            toolCalls: [
              {
                id: "progress",
                name: WORKFLOW_PROGRESS_TOOL,
                arguments: JSON.stringify({
                  completed: [{ id: "inspect", sourceRefs: [source] }],
                  nextAction: "Draft docs/GDD.md using the verified rules.",
                }),
              },
            ],
          };
        }
        assert.equal(document.checklist[0].checked, true);
        assert.equal(
          document.nextAction,
          "Draft docs/GDD.md using the verified rules.",
        );
        return {
          message: { role: "assistant" as const, content: "Ready to draft." },
        };
      },
    },
  });
  const result = await session.send("Write a GDD for the game.", {
    tools: {
      definitions,
      maximumCalls: 12,
      workingContext: context,
      async execute() {
        effects++;
        return JSON.stringify({ status: "completed", text: "Task is draft" });
      },
    },
  });
  assert.equal(result.message.content, "Ready to draft.");
  assert.equal(planning, 1);
  assert.equal(effects, 1);
  assert.equal(observed.length, 4);
  assert.equal(observed[0].originalRequest, "Write a GDD for the game.");
  assert.equal(observed[0].checklist[0].checked, false);
});

test("multiple rounds stay raw and only one batched reduction summarizes old findings", async () => {
  let planCalls = 0,
    reducerCalls = 0,
    rounds = 0;
  const seen: ReturnType<typeof JSON.parse>[] = [];
  const session = new ChatSession({
    model: "fixture",
    transport: {
      async complete(request: ChatRequest) {
        if (!request.tools) {
          if (request.outputSchema?.name === "a008_initial_workflow") {
            planCalls++;
            return {
              message: {
                role: "assistant" as const,
                content: JSON.stringify(plan),
              },
            };
          }
          reducerCalls++;
          const input = JSON.parse(request.messages[1]!.content);
          const refs: string[] = [
            ...(input.previous?.completedActions[0]?.sourceRefs ?? []),
            ...input.interactions.map((x: { id: string }) => x.id),
          ];
          return {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                version: "a008_run_continuation_state_v1",
                runId: input.runId,
                verifiedFacts: [],
                hypotheses: [],
                completedActions: [
                  {
                    id: "checked-files",
                    statement:
                      "Inspected task files and found the current requirements; avoid re-reading unchanged files",
                    sourceRefs: refs,
                  },
                ],
              }),
            },
          };
        }
        const doc = JSON.parse(
          request.messages.at(-1)!.content.split("\n").slice(1).join("\n"),
        );
        seen.push(doc);
        rounds++;
        if (rounds === 1)
          return {
            message: { role: "assistant" as const, content: "" },
            toolCalls: [
              {
                id: "s1",
                name: SELECT_TOOLS,
                arguments: '{"names":["read_file"]}',
              },
            ],
          };
        if (rounds <= 14)
          return {
            message: { role: "assistant" as const, content: "" },
            toolCalls: [
              {
                id: "r" + rounds,
                name: "read_file",
                arguments: JSON.stringify({
                  path: "docs/file" + rounds + ".md",
                }),
              },
            ],
          };
        return { message: { role: "assistant" as const, content: "done" } };
      },
    },
  });
  await session.send("Inspect project files and create a GDD", {
    tools: {
      definitions,
      maximumCalls: 20,
      workingContext: context,
      continuation: {
        recentRawInteractions: 4,
        maximumStateBytes: context.maximumStateBytes,
        compact: async () => {
          throw Error("Should use validated reducer");
        },
      },
      async execute() {
        return JSON.stringify({
          status: "completed",
          text: "Observed content",
        });
      },
    },
  });
  assert.equal(planCalls, 1);
  assert.ok(reducerCalls > 0 && reducerCalls < 6, String(reducerCalls));
  assert.ok(seen.at(-1)?.completedWorkChronological.length > 0);
  assert.equal(
    seen.at(-1)?.originalRequest,
    "Inspect project files and create a GDD",
  );
  assert.ok(seen.some((x) => x.recentUnreducedToolRounds.length >= 4));
});

test("workflow remains attached to durable checkpoint for process replacement", async () => {
  let saved: RunContinuationCheckpointWrite | undefined;
  let mainCalls = 0,
    planCalls = 0;
  const transport = {
    async complete(request: ChatRequest) {
      if (!request.tools) {
        planCalls++;
        return {
          message: {
            role: "assistant" as const,
            content: JSON.stringify(plan),
          },
        };
      }
      if (++mainCalls === 1)
        return {
          message: { role: "assistant" as const, content: "" },
          toolCalls: [
            {
              id: "selection",
              name: SELECT_TOOLS,
              arguments: '{"names":["read_file"]}',
            },
          ],
        };
      throw Error("Simulated process stop");
    },
  };
  const tools = {
    definitions,
    maximumCalls: 10,
    workingContext: context,
    durableWorkingContext: {
      persist: async (checkpoint: RunContinuationCheckpointWrite) => {
        saved = structuredClone(checkpoint);
      },
      recovery: { beforeEffect: async () => {} },
    },
    async execute() {
      return '{"status":"completed"}';
    },
  };
  await assert.rejects(
    new ChatSession({ model: "fixture", transport }).send("Build a GDD", {
      tools,
    }),
    /Simulated/,
  );
  assert.equal(planCalls, 1);
  assert.ok(saved?.recovery?.workflow);
  const checkpoint = validateContinuationRecovery(
    saved!.recovery!,
    context.maximumStateBytes,
  );
  assert.equal(
    checkpoint.workflow?.checklist[0]?.task,
    "Inspect relevant project instructions",
  );
  assert.equal(checkpoint.workflow?.nextAction, plan.nextAction);
});

test("recovered process receives the complete saved workflow without replanning or replay", async () => {
  let saved: RunContinuationCheckpointWrite | undefined;
  let planCalls = 0,
    steps = 0,
    reads = 0;
  const makeTransport = (recovering: boolean) => ({
    async complete(request: ChatRequest) {
      if (!request.tools) {
        planCalls++;
        return {
          message: {
            role: "assistant" as const,
            content: JSON.stringify(plan),
          },
        };
      }
      const envelope = JSON.parse(
        request.messages.at(-1)!.content.split("\n").slice(1).join("\n"),
      );
      assert.equal(envelope.originalRequest, "Prepare a GDD");
      assert.equal(envelope.nextAction, plan.nextAction);
      if (recovering) {
        assert.ok(
          envelope.recentUnreducedToolRounds.some(
            (round: { tools: { name: string }[] }) =>
              round.tools.some((tool) => tool.name === SELECT_TOOLS),
          ),
        );
        if (++steps === 1)
          return {
            message: { role: "assistant" as const, content: "" },
            toolCalls: [
              {
                id: "read_after_resume",
                name: "read_file",
                arguments: '{"path":"docs/CURRENT_TASK.md"}',
              },
            ],
          };
        return { message: { role: "assistant" as const, content: "Done" } };
      }
      if (++steps === 1)
        return {
          message: { role: "assistant" as const, content: "" },
          toolCalls: [
            {
              id: "before_stop",
              name: SELECT_TOOLS,
              arguments: '{"names":["read_file"]}',
            },
          ],
        };
      throw Error("Simulated process replacement");
    },
  });
  const persist = async (checkpoint: RunContinuationCheckpointWrite) => {
    saved = structuredClone(checkpoint);
  };
  const firstTools = {
    definitions,
    maximumCalls: 12,
    workingContext: context,
    durableWorkingContext: {
      persist,
      recovery: { beforeEffect: async () => {} },
    },
    async execute() {
      reads++;
      return '{"status":"completed"}';
    },
  };
  await assert.rejects(
    new ChatSession({ model: "fixture", transport: makeTransport(false) }).send(
      "Prepare a GDD",
      { tools: firstTools },
    ),
    /Simulated process replacement/,
  );
  assert.equal(planCalls, 1);
  steps = 0;
  const secondTools = {
    ...firstTools,
    durableWorkingContext: {
      persist,
      recovery: {
        beforeEffect: async () => {},
        resume: saved!.recovery!,
      },
    },
  };
  const result = await new ChatSession({
    model: "fixture",
    transport: makeTransport(true),
  }).send("Prepare a GDD", { tools: secondTools });
  assert.equal(result.message.content, "Done");
  assert.equal(planCalls, 1);
  assert.equal(reads, 1);
});

test("recovery validator rejects invented workflow progress references", () => {
  const recovery: RunContinuationRecovery = {
    version: 1,
    state: {
      version: "a008_run_continuation_state_v1",
      runId: "abc",
      verifiedFacts: [],
      hypotheses: [],
      completedActions: [],
    },
    recentInteractions: [sampleRead],
    completedInteractions: 1,
    usedToolCallIds: ["call_read"],
    routeId: "working-context:fixture",
    reduction: {
      version: 1,
      sourceRevision: 1,
      generation: 1,
      phase: "pending",
      attempts: 0,
      truncated: false,
      selectedTools: [],
    },
    workflow: {
      ...validateTaskWorkflow(plan),
      checklist: [
        {
          id: "inspect",
          task: "Inspect relevant project instructions",
          done: true,
          sourceRefs: ["invented:998"],
        },
        {
          id: "draft",
          task: "Create game design document",
          done: false,
          sourceRefs: [],
        },
        { id: "verify", task: "Verify output", done: false, sourceRefs: [] },
      ],
    },
  };
  assert.throws(
    () => validateContinuationRecovery(recovery, 40_000),
    /workflow checklist cites unavailable run source evidence/,
  );
  assert.throws(
    () =>
      validateTaskWorkflow({
        ...plan,
        checklist: [
          { id: "fake", task: "Unverified", done: true, sourceRefs: [] },
        ],
      }),
    /Invalid workflow item/,
  );
});

test("image input reaches the first provider request without a preliminary text-only planning call", async () => {
  let calls = 0;
  const session = new ChatSession({
    model: "fixture",
    transport: {
      async complete(request: ChatRequest) {
        calls++;
        assert.ok(request.tools);
        assert.equal(request.imageAttachments?.[0]?.mediaType, "image/png");
        const doc = JSON.parse(
          request.messages.at(-1)!.content.split("\n").slice(1).join("\n"),
        );
        assert.equal(doc.originalRequest, "Describe the uploaded image");
        assert.equal(doc.checklist.length, 3);
        return {
          message: { role: "assistant" as const, content: "described" },
        };
      },
    },
  });
  const response = await session.send("Describe the uploaded image", {
    imageAttachments: [
      { mediaType: "image/png", dataRef: "data:image/png;base64,YWJj" },
    ],
    tools: {
      definitions,
      maximumCalls: 4,
      workingContext: context,
      async execute() {
        throw Error("No tools expected");
      },
    },
  });
  assert.equal(response.message.content, "described");
  assert.equal(calls, 1);
});
