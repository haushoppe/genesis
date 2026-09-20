// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  api: 'http://localhost:3333',
  /**
   * SDK's mempoolApiUrl — routes through electrs. Dev + prod hit
   * api.ordpool.space; regtest replaces this file with
   * environment.regtest.ts pointing at the local electrs container.
   */
  mempoolApiUrl: 'https://api.ordpool.space',
  /**
   * Where the mint form loads each side as an <img> before enabling Mint
   * (side-image-check.ts). The cubes index probes the same host, so form
   * and rarity score agree on which sides render.
   */
  sideImageProbeBase: 'https://api.ordpool.space',
  /**
   * The SDK UtxoContentScanner's two ord `/output` sources (funding-safety
   * content scan). Dev + prod hit our ord instances; regtest replaces this
   * file with environment.regtest.ts pointing both at a local ord/stub that
   * resolves regtest outpoints.
   */
  ordApiUrl: 'https://ord.ordpool.space',
  cat21OrdApiUrl: 'https://ord.cat21.space',
  /**
   * HAUS HOPPE donation address baked as the silent reveal tip.
   * Regtest replaces this with a bcrt1p… address so the tip output
   * is spendable on the regtest chain.
   */
  haushoppeTipAddress: '???',
  haushoppeTipSats: 1000,
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
  ordinalsExplorerIframe: 'https://ordinals.com/preview/',
  // Our own witness-capable preview (ordpool-backend). Unlike
  // ordinalsExplorerIframe (ordinals.com, confirmed only), this renders an
  // inscription straight from the tx witness the moment it hits our mempool,
  // so a just-minted cube shows before confirmation. Used for the mint
  // success panel + "My cubes"; the public gallery keeps ordinals.com.
  ownPreviewIframe: 'https://api.ordpool.space/preview/',
  ordinalsExplorerDetails: 'https://ordinals.com/inscription/',
  // Both marketplaces render every inscription (whether listed or not).
  // Satflow uses the inscription ID at /ordinal/; ord.net uses the
  // inscription NUMBER at /inscription/ (id → number is a 308 redirect
  // there, we save the hop by passing the number directly).
  satflowMarketplace: 'https://www.satflow.com/ordinal/',
  ordNetMarketplace: 'https://ord.net/inscription/'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
