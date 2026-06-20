// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  api: 'http://localhost:3333',
  ordinalsExplorerIframe: 'https://ordinals.com/preview/',
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
