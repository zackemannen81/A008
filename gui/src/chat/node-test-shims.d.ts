/** Minimal shims so chat Node tests typecheck in the GUI package. */
declare module "node:test" {
  export function test(
    name: string,
    fn: () => void | Promise<void>,
  ): void;
}

declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown): void;
    notEqual(actual: unknown, expected: unknown): void;
    deepEqual(actual: unknown, expected: unknown): void;
    ok(value: unknown, message?: string): void;
  };
  export default assert;
}
