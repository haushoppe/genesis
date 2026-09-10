import { withDarkColorScheme } from './with-dark-color-scheme';

const REAL_CUBE =
  `<html><!--cubes.haushoppe.art--><body><script>t='` +
  'a'.repeat(64) + 'i0|' + 'b'.repeat(64) + `i0'</script></body></html>`;

const PLACEHOLDER_CUBE =
  `<html><!--cubes.haushoppe.art--><body><script>t='` +
  `../assets/_______________________________________________side1.svg'</script></body></html>`;

describe('withDarkColorScheme', () => {
  it('always injects the dark color-scheme meta', () => {
    expect(withDarkColorScheme(REAL_CUBE)).toContain('<meta name="color-scheme" content="dark">');
    expect(withDarkColorScheme(PLACEHOLDER_CUBE)).toContain('<meta name="color-scheme" content="dark">');
  });

  it('gives a real cube the ordinals.com base (skips the /content redirect)', () => {
    expect(withDarkColorScheme(REAL_CUBE)).toContain('<base href="https://ordinals.com/">');
  });

  it('OMITS the base when the body carries a preview-fallback side', () => {
    // A placeholder side climbs /content/../assets/… back to the app origin;
    // an ordinals.com base would send it to ordinals.com/assets/… → 404.
    expect(withDarkColorScheme(PLACEHOLDER_CUBE)).not.toContain('<base');
  });

  it('injects inside an existing <head> when present', () => {
    const withHead = `<html><head><title>x</title></head><body></body></html>`;
    const out = withDarkColorScheme(withHead);
    expect(out).toContain('<head><base href="https://ordinals.com/"><meta name="color-scheme" content="dark"><title>x</title>');
  });
});
