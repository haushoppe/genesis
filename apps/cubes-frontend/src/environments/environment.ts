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
   * HAUS HOPPE donation address baked as the silent reveal tip.
   * Regtest replaces this with a bcrt1p… address so the tip output
   * is spendable on the regtest chain.
   */
  haushoppeTipAddress: '???',
  haushoppeTipSats: 1000,
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
