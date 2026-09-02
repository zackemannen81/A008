declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    match(actual: string, regexp: RegExp, message?: string): void;
    rejects(
      block: Promise<unknown> | (() => Promise<unknown>),
      error?: unknown,
      message?: string,
    ): Promise<void>;
    fail(message?: string): never;
  };
  export default assert;
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readdirSync(path: string): string[];
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...parts: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:test" {
  function test(name: string, fn: () => void | Promise<void>): void;
  export default test;
}
