import { randomUUID } from "node:crypto";
import { IdentityError } from "./errors.js";
import type {
  AnyRuntimeId,
  RuntimeId,
  RuntimeIdentityKind,
  UuidFactory,
} from "./types.js";

export const RUNTIME_ID_VERSION = "v1" as const;
export const RUNTIME_IDENTITY_KINDS = [
  "project",
  "conversation",
  "task",
  "agent",
  "acp_session",
] as const satisfies readonly RuntimeIdentityKind[];

const UUID_V4_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const UUID_V4_REGEX = new RegExp(`^${UUID_V4_PATTERN}$`);
const RUNTIME_ID_REGEX = new RegExp(
  `^A008_${RUNTIME_ID_VERSION}_(project|conversation|task|agent|acp_session)_(${UUID_V4_PATTERN})$`,
);

export function parseRuntimeId<Kind extends RuntimeIdentityKind>(
  value: string,
  expectedKind: Kind,
): RuntimeId<Kind>;
export function parseRuntimeId(value: string): AnyRuntimeId;
export function parseRuntimeId<Kind extends RuntimeIdentityKind>(
  value: string,
  expectedKind?: Kind,
): RuntimeId<Kind> | AnyRuntimeId {
  const match = RUNTIME_ID_REGEX.exec(value);
  if (match === null) {
    throw new IdentityError(
      "invalid_id",
      "Runtime ID must use canonical A008_v1_<kind>_<lowercase UUIDv4> format.",
    );
  }
  const actualKind = match[1] as RuntimeIdentityKind;
  if (expectedKind !== undefined && actualKind !== expectedKind) {
    throw new IdentityError(
      "wrong_kind",
      `Expected runtime identity kind ${expectedKind}, received ${actualKind}.`,
    );
  }
  return value as RuntimeId<Kind> | AnyRuntimeId;
}

export function runtimeIdentityKind(value: string): RuntimeIdentityKind {
  parseRuntimeId(value);
  return RUNTIME_ID_REGEX.exec(value)![1] as RuntimeIdentityKind;
}

export function isRuntimeId<Kind extends RuntimeIdentityKind>(
  value: unknown,
  expectedKind?: Kind,
): value is RuntimeId<Kind> {
  if (typeof value !== "string") {
    return false;
  }
  try {
    if (expectedKind === undefined) {
      parseRuntimeId(value);
    } else {
      parseRuntimeId(value, expectedKind);
    }
    return true;
  } catch (error) {
    if (error instanceof IdentityError) {
      return false;
    }
    throw error;
  }
}

export class RuntimeIdentityFactory {
  readonly #uuidFactory: UuidFactory;

  constructor(uuidFactory: UuidFactory = randomUUID) {
    this.#uuidFactory = uuidFactory;
  }

  create<Kind extends RuntimeIdentityKind>(kind: Kind): RuntimeId<Kind> {
    if (!RUNTIME_IDENTITY_KINDS.includes(kind)) {
      throw new IdentityError(
        "invalid_id",
        `Unsupported runtime ID kind: ${kind}`,
      );
    }
    const uuid = this.#uuidFactory();
    if (!UUID_V4_REGEX.test(uuid)) {
      throw new IdentityError(
        "invalid_id",
        "UUID factory must return a canonical lowercase UUIDv4.",
      );
    }
    return parseRuntimeId(`A008_${RUNTIME_ID_VERSION}_${kind}_${uuid}`, kind);
  }
}
