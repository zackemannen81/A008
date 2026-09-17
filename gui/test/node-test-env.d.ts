/**
 * The single ambient declaration of the Node built-ins used by GUI tests
 * (A008-0039).
 *
 * The GUI package deliberately does not depend on `@types/node`: the renderer
 * must never reach for a Node built-in, so publishing the full Node typings
 * into `gui/src` would weaken that boundary. Only `*.test.ts` files import
 * `node:test`, `node:assert/strict`, and the three read-only helpers below, so
 * this file declares exactly that surface and nothing more.
 *
 * It replaces `gui/src/chat/node-test-shims.d.ts`,
 * `gui/src/composer/node-test.d.ts`, and `gui/src/session/node-ambient.d.ts`,
 * which declared overlapping versions of the same modules and only coexisted
 * because `gui/tsconfig.json` sets `skipLibCheck: true`. That flag is
 * unchanged; the duplicates are gone.
 */

declare module "node:test" {
  type TestBody = () => void | Promise<void>;
  /** Named import form, used by `gui/src/chat`. */
  function test(name: string, fn: TestBody): void;
  export { test };
  /** Default import form, used by `gui/src/composer` and `gui/src/session`. */
  export default test;
}

declare module "node:assert/strict" {
  interface StrictAssert {
    /**
     * Mirrors the real `node:assert/strict` typings, where `equal` narrows its
     * first argument. `gui/src/session` leans on that through an optional
     * chain: `assert.equal(request?.type, "session/new")` is what makes
     * `request` non-optional on the following line.
     */
    equal<T>(
      actual: unknown,
      expected: T,
      message?: string,
    ): asserts actual is T;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    match(actual: string, regexp: RegExp, message?: string): void;
    /**
     * `asserts value` is load-bearing, not decoration. Tests in `gui/src/chat`
     * and `gui/src/session` rely on `assert.ok` to narrow a union or drop an
     * `undefined` before the next line touches the value, exactly as the real
     * `node:assert/strict` typings do. Declaring it as returning `void`
     * compiles the declaration but breaks 46 call sites downstream.
     */
    ok(value: unknown, message?: string): asserts value;
    fail(message?: string): never;
    throws(
      fn: () => unknown,
      error?: ((error: unknown) => boolean) | RegExp,
      message?: string,
    ): void;
    rejects(
      block: (() => Promise<unknown>) | Promise<unknown>,
      error?: unknown,
      message?: string,
    ): Promise<void>;
  }
  const assert: StrictAssert;
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
