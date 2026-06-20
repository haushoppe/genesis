export const environment = {
  production: true,
  api: 'https://backend.haushoppe.art',
  ordinalsExplorerIframe: 'https://explorer.ordinalsbot.com/content/',
  ordinalsExplorerDetails: 'https://ordinals.com/inscription/',
  ordinalsExplorerMarketplace: 'https://www.satflow.com/item/',
  // ord.net renders the on-chain Save Ordinals gallery at /gallery/<inscription-number>.
  // Inscription #122,282,476 (cube #531) bundles all 530 historical cubes as
  // properties.gallery metadata. Trailing # so the cube number we append acts
  // as a fragment hint on the gallery page.
  ordExplorerGallery: 'https://ord.net/gallery/122282476#'
};
