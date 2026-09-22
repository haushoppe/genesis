import { withSelfHostedBannerAssets } from './banner-self-hosted';

const SIDES = ['a'.repeat(64) + 'i0', 'b'.repeat(64) + 'i0', 'c'.repeat(64) + 'i0',
               'd'.repeat(64) + 'i0', 'e'.repeat(64) + 'i0', 'f'.repeat(64) + 'i0'];
const RENDERER = '9'.repeat(64) + 'i0';
const cube = () =>
  `<html><!--cubes.haushoppe.art--><body><script>t='${SIDES.join('|')}|1|1|#000|#111|#222'</script>`
  + `<script src=/content/${RENDERER}></script>`;

describe('withSelfHostedBannerAssets', () => {
  it('leaves no /content/ reference, so the header needs no ord', () => {
    expect(withSelfHostedBannerAssets(cube(), SIDES)).not.toContain('/content/');
  });

  it('maps each side to its own self-hosted file, in order', () => {
    const out = withSelfHostedBannerAssets(cube(), SIDES);
    SIDES.forEach((id, i) => {
      expect(out).not.toContain(id);
      expect(out).toContain(`../assets/banner/side-${i + 1}.webp`);
    });
  });

  it('points the renderer at the self-hosted copy', () => {
    expect(withSelfHostedBannerAssets(cube(), SIDES))
      .toContain('<script src=/assets/banner/renderer.js></script>');
  });

  it('loads the scene bundle as a classic script, which needs no CORS', () => {
    // The iframe is sandboxed without allow-same-origin, so its origin is
    // `null` and a fetch to our own asset is cross-origin and blocked. A
    // classic <script src> is not restricted that way.
    const out = withSelfHostedBannerAssets(cube(), SIDES);
    expect(out).toContain('<script src=/assets/banner/deps.js></script>');
    expect(out.indexOf('deps.js')).toBeLessThan(out.indexOf('renderer.js'));
  });

  it('throws rather than silently fetching from an ord when a side id is stale', () => {
    // If bannerCubeSides and the generated body drift apart, the unmatched id
    // stays in the body and the banner quietly reaches for ordinals.com. That
    // must fail loudly at build time instead.
    expect(() => withSelfHostedBannerAssets(cube(), [...SIDES.slice(0, 5), 'z'.repeat(64) + 'i0']))
      .toThrow(/side 6 .* is not in the cube body/);
  });

  it('throws when the renderer script tag is missing', () => {
    const noRenderer = `<html><!--cubes.haushoppe.art--><body><script>t='${SIDES.join('|')}'</script>`;
    expect(() => withSelfHostedBannerAssets(noRenderer, SIDES)).toThrow(/no on-chain renderer script/);
  });
});
