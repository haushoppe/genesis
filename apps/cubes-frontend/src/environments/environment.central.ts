// Central-regtest environment: points the cubes frontend at the SHARED
// workspace regtest stack (workspace-root regtest/), whose host ports mirror
// the prod cloudflared tunnel targets. Serve with `ng serve -c central`, or
// `make cubes-fe` from regtest/.
//
// Distinct from environment.regtest.ts, which targets cubes-frontend's OWN
// e2e stack (its bitcoind/electrs/ord on standard ports). The central stack
// reuses OUR fork backends on prod-parity ports; this file points at those.
//
// URLs derive from the page's own hostname so one build works on localhost and
// via a LAN IP through the nginx dev-proxy. /api is same-origin, proxied to the
// ordpool-backend on :8999 (which proxies to electrs) — NOT :3000 directly,
// because that host port is shadowed. See proxy.conf.central.json.
const host = typeof location !== 'undefined' ? location.hostname : 'localhost';

export const environment = {
  production: false,
  // cat21-indexer backend (= backend2.cat21.space).
  api: `http://${host}:3333`,
  // Same-origin; proxied to ordpool-backend :8999 -> electrs (avoids :3000).
  mempoolApiUrl: '',
  // Cube sides are mainnet inscriptions even when the mint happens on regtest,
  // so the mint form's black-face check loads them from mainnet content.
  sideImageProbeBase: 'https://api.ordpool.space',
  // Full ord (= ord.ordpool.space) = the central ord-stock container.
  ordApiUrl: `http://${host}:3838`,
  // cat21-ord (= ord.cat21.space).
  cat21OrdApiUrl: `http://${host}:8080`,
  haushoppeTipAddress: 'bcrt1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqvg32hk',
  haushoppeTipSats: 1000,
  // The cube RENDERER inscription is a mainnet inscription, so its /content +
  // /preview load from ordinals.com even while the MINT happens on regtest
  // (see proxy.conf.central.json). Detail links point at the central full ord.
  /**
   * The cube renderer inscription every cube body loads through
   * `<script src=/content/...>`. It is part of the MINTED BYTES, so a chain
   * that cannot serve it renders no cube: regtest replaces this file and
   * points at the renderer its bootstrap inscribed, byte-identical to this
   * one. `parseCube` accepts whatever this names in the v3 slot, so a cube
   * minted here still reads as v3.
   */
  cubeRendererInscriptionId: 'fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0',
  /**
   * Preview-only fallback faces, the digits 1 to 6 shown on a side the user
   * has not filled yet (the BitcoinOneZero collection, image/png). They load
   * through `/content/<id>` like any real face and never gate minting: the
   * mint gate is the form validator, where every side field is `required`.
   */
  previewFallbackSides: [
    'df58fbb44dbb2a9b17405f944c8ff966fd120cccda87873f3206f012ea239bebi0', // 1
    'ad8d751046787e22a0ef89a15b7f0e5eedae927a488a8ecc7e30711a7692fb11i0', // 2
    'fe4e588430b19d6e8b81005a3515a0f634fb3cd3b3bdf372bc7b12b50e302acci0', // 3
    '9825f7f09818f0adb7d3b20a4db6aa92f9af850bd4e0597db6b7ade3790b0f5bi0', // 4
    '412cb15b19496075ef9afbd07fbabe6d6e08461c30845fafe4ece083fd20d84fi0', // 5
    '81c64b1c7dfa8ce4e9e32dbcf68fbb51e004fb56be5b2253c880cd833ae74bcai0', // 6
  ],
  ordinalsExplorerIframe: `http://${host}:3838/preview/`,
  // Witness-capable preview (ordpool-backend, port 8999) for the mint success
  // panel + "My cubes": renders from the mempool witness before confirmation.
  ownPreviewIframe: `http://${host}:8999/preview/`,
  ordinalsExplorerDetails: `http://${host}:3838/inscription/`,
  satflowMarketplace: 'https://www.satflow.com/ordinal/',
  ordNetMarketplace: 'https://ord.net/inscription/',
};
