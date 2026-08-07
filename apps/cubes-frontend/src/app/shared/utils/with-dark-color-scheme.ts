/**
 * Prepend a color-scheme=dark meta to a cube's HTML body so the
 * iframe canvas paints dark instead of white while the cube JS is
 * still loading. Display-only wrapper — never send to the SDK.
 */
export function withDarkColorScheme(cubeBodyHtml: string): string {
  const META_HEAD = '<head><meta name="color-scheme" content="dark"></head>';
  return cubeBodyHtml.replace(/^<html>/i, `<html>${META_HEAD}`);
}
