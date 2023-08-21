/**
 * Removes all trailing pipes from the given string.
 * If a falsy value is provided, it returns an empty string.
 *
 * @param {string} str - The input string.
 * @returns {string} - The string without trailing pipes.
 */
export function removeTrailingPipes(str?: string | null): string {
  if (!str) return '';
  return str.replace(/\|+$/, '');
}
