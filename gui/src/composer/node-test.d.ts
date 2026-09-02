declare module "node:test" {
  export default function test(
    name: string,
    fn: () => void | Promise<void>,
  ): void;
}

declare module "node:assert/strict" {
  interface StrictAssert {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    match(actual: string, regexp: RegExp, message?: string): void;
    ok(value: unknown, message?: string): void;
    throws(
      fn: () => unknown,
      error?: ((error: unknown) => boolean) | RegExp,
      message?: string,
    ): void;
    rejects(
      block: (() => Promise<unknown>) | Promise<unknown>,
      error?: ((error: unknown) => boolean) | RegExp,
      message?: string,
    ): Promise<void>;
  }
  const assert: StrictAssert;
  export default assert;
}
