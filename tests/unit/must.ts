/** Narrow a value that the test has just established to be present, without `!`. */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('expected a value, got nullish');
  return value;
}
