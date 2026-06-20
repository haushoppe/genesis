// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  api: 'http://localhost:3333',
  ordinalsExplorerIframe: 'https://explorer.ordinalsbot.com/content/',
  ordinalsExplorerDetails: 'https://ordinals.com/inscription/',
  ordinalsExplorerMarketplace: 'https://www.satflow.com/item/',
  // ord.net renders the on-chain Save Ordinals gallery at /gallery/<inscription-number>.
  // Inscription #122,282,476 (cube #531) bundles all 530 historical cubes as
  // properties.gallery metadata. Trailing # so the cube number we append acts
  // as a fragment hint on the gallery page.
  ordExplorerGallery: 'https://ord.net/gallery/122282476#'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
