/**
 * Point the banner cube at SELF-HOSTED assets instead of an ord.
 *
 * The header is decorative and must not depend on a third party. Left alone
 * it pulls 622,846 bytes from ordinals.com through a redirect hop each
 * (`cubes.haushoppe.art/content/<id>` 301s there): six 1024px PNG sides at
 * 370,196 B plus the renderer and its three.js/fflate bundle at 252,650 B.
 *
 * Self-hosted at 512px WebP that is 151,896 B of sides plus the same
 * renderer and bundle, from our own origin with no redirect and no external
 * dependency. 512px is well above the ~200px the faces occupy on screen and
 * leaves retina headroom.
 *
 * Two substitutions, both on a DISPLAY-ONLY copy:
 *
 *  - the renderer `<script src>` becomes two self-hosted tags: the scene
 *    bundle (`deps.js`, the on-chain deps document verbatim as a global) and
 *    the renderer itself, a byte copy with one change, reading that global
 *    instead of fetching `/content/<dep id>`.
 *  - each side id becomes `../assets/banner/side-N.webp`. The renderer builds
 *    every face URL as `/content/${entry}`, so the `../` walks back out and
 *    the browser resolves `/content/../assets/banner/side-1.webp` to
 *    `/assets/banner/side-1.webp`. Substituting the id is the only hook: ids
 *    cannot be replaced before generation because `getCubeHtml` rejects a
 *    non-id and swaps in a fallback side.
 *
 * Never applied to a minted body. This copy is not a canonical cube and
 * `parseCube` rejects it, which the spec pins.
 */

/** The renderer id a cube body carries, replaced by the self-hosted copy. */
const ON_CHAIN_RENDERER_SCRIPT = /<script src=\/content\/[0-9a-f]{64}i\d+><\/script>/;

export function withSelfHostedBannerAssets(cubeBodyHtml: string, sideIds: readonly string[]): string {
  let out = cubeBodyHtml;

  sideIds.forEach((id, i) => {
    if (!out.includes(id)) {
      throw new Error(
        `withSelfHostedBannerAssets: side ${i + 1} (${id}) is not in the cube body, so the `
        + 'substitution is stale and the banner would silently fetch from an ord.',
      );
    }
    out = out.split(id).join(`../assets/banner/side-${i + 1}.webp`);
  });

  if (!ON_CHAIN_RENDERER_SCRIPT.test(out)) {
    throw new Error(
      'withSelfHostedBannerAssets: no on-chain renderer script tag found, so the renderer '
      + 'would still be fetched from an ord.',
    );
  }
  // The deps bundle loads as a classic script that sets a global, NOT via
  // fetch: the banner iframe is `sandbox="allow-scripts"` with no
  // `allow-same-origin`, so its origin is `null` and a fetch to our own asset
  // is cross-origin and blocked. ordinals.com only worked because it answers
  // `access-control-allow-origin: *`. A classic <script src> has no such
  // restriction, so this needs no CORS header and no weakening of the sandbox.
  return out.replace(
    ON_CHAIN_RENDERER_SCRIPT,
    '<script src=/assets/banner/deps.js></script><script src=/assets/banner/renderer.js></script>',
  );
}
