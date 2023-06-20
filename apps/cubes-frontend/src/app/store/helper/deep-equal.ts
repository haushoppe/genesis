/* eslint-disable @typescript-eslint/no-explicit-any */

// TODO: use a more efficient method
export function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
