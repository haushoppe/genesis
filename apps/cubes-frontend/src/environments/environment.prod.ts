export const environment = {
  production: true,
  api: 'https://backend.haushoppe.art',
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
