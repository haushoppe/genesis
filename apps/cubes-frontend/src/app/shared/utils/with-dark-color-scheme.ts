/**
 * Inject a color-scheme=dark meta into a cube's HTML head so the
 * iframe canvas paints dark instead of white during cube JS load.
 * Display-only wrapper — never send to the SDK.
 *
 * Handles both shapes: bodies that already have a `<head>` get the
 * meta prepended inside it; bodies without one get a fresh `<head>`.
 */
const META = '<meta name="color-scheme" content="dark">';

export function withDarkColorScheme(cubeBodyHtml: string): string {
  if (/<head\b[^>]*>/i.test(cubeBodyHtml)) {
    return cubeBodyHtml.replace(/<head\b[^>]*>/i, (m) => `${m}${META}`);
  }
  return cubeBodyHtml.replace(/^<html\b[^>]*>/i, (m) => `${m}<head>${META}</head>`);
}
