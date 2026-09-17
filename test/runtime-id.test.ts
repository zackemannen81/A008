import assert from "node:assert/strict";
import test from "node:test";
import { IdentityError } from "../src/identity/errors.js";
import {
  isRuntimeId,
  parseRuntimeId,
  RUNTIME_IDENTITY_KINDS,
  RuntimeIdentityFactory,
  runtimeIdentityKind,
} from "../src/identity/runtime-id.js";
import type { RuntimeIdentityKind } from "../src/identity/types.js";

const UUID = "01234567-89ab-4cde-8abc-0123456789ab";

test("every runtime identity kind creates and parses in canonical v1 format", () => {
  const factory = new RuntimeIdentityFactory(() => UUID);

  for (const kind of RUNTIME_IDENTITY_KINDS) {
    const id = factory.create(kind);
    assert.equal(id, `A008_v1_${kind}_${UUID}`);
    assert.equal(parseRuntimeId(id, kind), id);
    assert.equal(runtimeIdentityKind(id), kind);
    assert.equal(isRuntimeId(id, kind), true);
  }
});

test("runtime IDs reject malformed, non-canonical, docs-task, and wrong-kind values", () => {
  const projectId = new RuntimeIdentityFactory(() => UUID).create("project");

  assert.throws(
    () => parseRuntimeId(projectId, "conversation"),
    (error: unknown) =>
      error instanceof IdentityError && error.code === "wrong_kind",
  );
  for (const value of [
    "A008-0007",
    `A008_v2_project_${UUID}`,
    `A008_v1_project_${UUID.toUpperCase()}`,
    "A008_v1_project_01234567-89ab-1cde-8abc-0123456789ab",
    "project-owner@example.com",
    "",
  ]) {
    assert.equal(isRuntimeId(value), false);
    assert.throws(
      () => parseRuntimeId(value),
      (error: unknown) =>
        error instanceof IdentityError && error.code === "invalid_id",
    );
  }
});

test("runtime ID factory validates injected UUID output and identity kind", () => {
  assert.throws(
    () => new RuntimeIdentityFactory(() => "not-a-uuid").create("agent"),
    (error: unknown) =>
      error instanceof IdentityError && error.code === "invalid_id",
  );
  assert.throws(
    () =>
      new RuntimeIdentityFactory(() => UUID).create(
        "user" as RuntimeIdentityKind,
      ),
    (error: unknown) =>
      error instanceof IdentityError && error.code === "invalid_id",
  );
});

test("default runtime ID generation is unique and contains only routing metadata", () => {
  const factory = new RuntimeIdentityFactory();
  const ids = new Set(
    Array.from({ length: 100 }, () => factory.create("conversation")),
  );

  assert.equal(ids.size, 100);
  for (const id of ids) {
    assert.match(id, /^A008_v1_conversation_[0-9a-f-]{36}$/);
    assert.ok(!id.includes("owner"));
    assert.ok(!id.includes("task description"));
  }
});
