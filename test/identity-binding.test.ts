import assert from "node:assert/strict";
import test from "node:test";
import { IdentityError } from "../src/identity/errors.js";
import { InMemoryAcpIdentityBindingRepository } from "../src/identity/in-memory-binding-repository.js";
import { RuntimeIdentityFactory } from "../src/identity/runtime-id.js";
import type { AcpIdentityBinding, ProjectId } from "../src/identity/types.js";

function identityFactory(): RuntimeIdentityFactory {
  let sequence = 0;
  return new RuntimeIdentityFactory(
    () =>
      `00000000-0000-4000-8000-${(++sequence).toString().padStart(12, "0")}`,
  );
}

function binding(
  factory: RuntimeIdentityFactory,
  overrides: Partial<AcpIdentityBinding> = {},
): AcpIdentityBinding {
  return {
    projectId: factory.create("project"),
    conversationId: factory.create("conversation"),
    taskId: factory.create("task"),
    agentId: factory.create("agent"),
    acpSessionId: factory.create("acp_session"),
    externalReferences: [],
    ...overrides,
  };
}

test("binding registration is idempotent and resolves every supported query", async () => {
  const repository = new InMemoryAcpIdentityBindingRepository();
  const value = binding(identityFactory(), {
    externalReferences: [
      { system: "canvas", kind: "conversation", value: "canvas-1" },
      { system: "agent_server", kind: "conversation", value: "server-1" },
    ],
  });

  assert.equal(await repository.register(value), "created");
  assert.equal(
    await repository.register({
      ...value,
      externalReferences: [...value.externalReferences].reverse(),
    }),
    "existing",
  );
  assert.deepEqual(await repository.resolveAcpSession(value.acpSessionId), {
    ...value,
    externalReferences: [
      { system: "agent_server", kind: "conversation", value: "server-1" },
      { system: "canvas", kind: "conversation", value: "canvas-1" },
    ],
  });
  assert.equal(
    (
      await repository.resolveExternal({
        system: "agent_server",
        kind: "conversation",
        value: "server-1",
      })
    )?.acpSessionId,
    value.acpSessionId,
  );
  assert.deepEqual(
    (await repository.listConversation(value.conversationId)).map(
      (item) => item.acpSessionId,
    ),
    [value.acpSessionId],
  );
});

test("one conversation permits multiple tasks and sessions with stable project and agent", async () => {
  const factory = identityFactory();
  const repository = new InMemoryAcpIdentityBindingRepository();
  const first = binding(factory, { externalReferences: [] });
  const second = binding(factory, {
    projectId: first.projectId,
    conversationId: first.conversationId,
    agentId: first.agentId,
    externalReferences: [],
  });

  assert.equal(await repository.register(first), "created");
  assert.equal(await repository.register(second), "created");
  const listed = await repository.listConversation(first.conversationId);
  assert.equal(listed.length, 2);
  assert.deepEqual(
    new Set(listed.map((item) => item.taskId)),
    new Set([first.taskId, second.taskId]),
  );
});

test("session, external, project, and agent conflicts roll back all indexes", async () => {
  const factory = identityFactory();
  const repository = new InMemoryAcpIdentityBindingRepository();
  const original = binding(factory, {
    externalReferences: [
      { system: "agent_server", kind: "conversation", value: "server-1" },
    ],
  });
  await repository.register(original);

  const conflicts: AcpIdentityBinding[] = [
    binding(factory, {
      acpSessionId: original.acpSessionId,
      externalReferences: [],
    }),
    binding(factory, {
      externalReferences: [
        { system: "agent_server", kind: "conversation", value: "server-1" },
      ],
    }),
    binding(factory, {
      conversationId: original.conversationId,
      agentId: original.agentId,
      externalReferences: [],
    }),
    binding(factory, {
      conversationId: original.conversationId,
      projectId: original.projectId,
      externalReferences: [],
    }),
  ];

  for (const conflicting of conflicts) {
    await assert.rejects(
      () => repository.register(conflicting),
      (error: unknown) =>
        error instanceof IdentityError && error.code === "identity_conflict",
    );
  }
  assert.deepEqual(
    (await repository.listConversation(original.conversationId)).map(
      (item) => item.acpSessionId,
    ),
    [original.acpSessionId],
  );
  assert.equal(
    (
      await repository.resolveExternal({
        system: "agent_server",
        kind: "conversation",
        value: "server-1",
      })
    )?.acpSessionId,
    original.acpSessionId,
  );
});

test("binding repository rejects wrong kinds and invalid external references", async () => {
  const factory = identityFactory();
  const repository = new InMemoryAcpIdentityBindingRepository();
  const wrongKind = binding(factory, {
    projectId: factory.create("agent") as unknown as ProjectId,
  });
  await assert.rejects(
    () => repository.register(wrongKind),
    (error: unknown) =>
      error instanceof IdentityError && error.code === "wrong_kind",
  );

  const invalidExternal = binding(factory, {
    externalReferences: [
      { system: "Agent Server", kind: "conversation", value: " external " },
    ],
  });
  await assert.rejects(
    () => repository.register(invalidExternal),
    (error: unknown) =>
      error instanceof IdentityError &&
      error.code === "invalid_external_reference",
  );
});

test("concurrent external-reference claims serialize with one atomic winner", async () => {
  const factory = identityFactory();
  const repository = new InMemoryAcpIdentityBindingRepository();
  const reference = {
    system: "agent_server",
    kind: "conversation",
    value: "contended",
  } as const;
  const left = binding(factory, { externalReferences: [reference] });
  const right = binding(factory, { externalReferences: [reference] });

  const results = await Promise.allSettled([
    repository.register(left),
    repository.register(right),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  const resolved = await repository.resolveExternal(reference);
  assert.ok(
    resolved?.acpSessionId === left.acpSessionId ||
      resolved?.acpSessionId === right.acpSessionId,
  );
});

test("binding lookups return defensive copies", async () => {
  const repository = new InMemoryAcpIdentityBindingRepository();
  const value = binding(identityFactory(), {
    externalReferences: [
      { system: "agent_server", kind: "conversation", value: "defensive" },
    ],
  });
  await repository.register(value);
  const read = await repository.resolveAcpSession(value.acpSessionId);
  assert.ok(read);
  (read.externalReferences[0] as { value: string }).value = "mutated";

  const stored = await repository.resolveAcpSession(value.acpSessionId);
  assert.notEqual(stored?.externalReferences[0]?.value, "mutated");
});
