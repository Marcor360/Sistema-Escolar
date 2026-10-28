/** Partial unit-test dependencies, including nested repositories and Jest spies.
 * Names and ordinary function signatures are checked; Jest owns its mock signatures.
 * Omitted members do not exist at runtime: only stub the paths exercised by a test.
 */
export type Stub<T> = T extends (...args: never[]) => unknown
  ? T | jest.Mock
  : T extends object
    ? { [K in keyof T]?: Stub<T[K]> }
    : T;

export function stub<T>(members: Stub<T>): T {
  return members as T;
}
