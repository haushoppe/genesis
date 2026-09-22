export const environment = {
  production: true,
  api: 'https://backend.haushoppe.art',
  // Chain this build talks to; drives the SDK's bitcoinNetwork.
  network: 'mainnet' as 'mainnet' | 'regtest',
  mempoolApiUrl: 'https://api.ordpool.space',
  // Where the mint form loads each side as an <img> before enabling Mint
  // (side-image-check.ts). The cubes index probes the same host, so form and
  // rarity score agree on which sides render.
  sideImageProbeBase: 'https://api.ordpool.space',
  // SDK UtxoContentScanner's two ord `/output` sources (funding-safety scan).
  ordApiUrl: 'https://ord.ordpool.space',
  cat21OrdApiUrl: 'https://ord.cat21.space',
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
  /** Six sides of the featured cube the header renders. */
  /** Regtest-only stand-in galleries for the cube suggestion; empty here, so
   *  the suggestion comes from the Magic Eden archive as normal. */
  /** The cubes index the gallery reads. Empty means there is no index for
   *  this chain and the gallery lists nothing rather than reaching elsewhere. */
  cubesIndexBase: 'https://ordpool-space.github.io/ordinal-cubes-index/data',
  suggestionGalleries: [] as { symbol: string; name: string; inscriptionIds: string[] }[],
  bannerCubeSides: [
    '0a595eb00dffb649952951e76fa5cdd1032d621a91f1d75402eec692bb567da2i0',
    '31ad74da8f8162696570a538e51956d659ed8ba5af21ea6dd667eb7b54298ee5i0',
    '8f6d156fb339697f67adcfd54ae300a7b9f8a7f1f36c9cc6f79960508a9da881i0',
    '30078f5394421c1593be2c06c7ca890c53ccc017550dc019e0c8a37a5f563cbei0',
    '9a397c46bd6a547f697e186fa803bb71f2d7c58b62b733f7b1411ebf9fc88efdi0',
    'b53e29d74eb41d7720760cb9c1b93eb9be0eaadbcf086aea0172672f6cce82aei0',
  ],
  previewFallbackSides: [
    'df58fbb44dbb2a9b17405f944c8ff966fd120cccda87873f3206f012ea239bebi0', // 1
    'ad8d751046787e22a0ef89a15b7f0e5eedae927a488a8ecc7e30711a7692fb11i0', // 2
    'fe4e588430b19d6e8b81005a3515a0f634fb3cd3b3bdf372bc7b12b50e302acci0', // 3
    '9825f7f09818f0adb7d3b20a4db6aa92f9af850bd4e0597db6b7ade3790b0f5bi0', // 4
    '412cb15b19496075ef9afbd07fbabe6d6e08461c30845fafe4ece083fd20d84fi0', // 5
    '81c64b1c7dfa8ce4e9e32dbcf68fbb51e004fb56be5b2253c880cd833ae74bcai0', // 6
  ],
  ordinalsExplorerIframe: 'https://ordinals.com/preview/',
  // Our own witness-capable preview (ordpool-backend). Renders an inscription
  // from the tx witness the moment it hits our mempool, so a just-minted cube
  // shows before confirmation. Used for the mint success panel + "My cubes".
  ownPreviewIframe: 'https://api.ordpool.space/preview/',
  ordinalsExplorerDetails: 'https://ordinals.com/inscription/',
  // Both marketplaces render every inscription (whether listed or not).
  // Satflow uses the inscription ID at /ordinal/; ord.net uses the
  // inscription NUMBER at /inscription/ (id → number is a 308 redirect
  // there, we save the hop by passing the number directly).
  satflowMarketplace: 'https://www.satflow.com/ordinal/',
  ordNetMarketplace: 'https://ord.net/inscription/'
};
