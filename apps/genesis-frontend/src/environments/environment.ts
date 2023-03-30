// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { KnownTokenName } from "../../../shared/known-token-name";

export const environment = {
  production: false,
  api: 'http://localhost:3333',
  tokenName: KnownTokenName.genesis,
  // You cannot set a timeout directly on a Web3Provider,
  // because there is not necessarily an underlying network connection.
  // For example, MetaMask is not something that can timeout, since it is an injected object.
  // see https://github.com/ethers-io/ethers.js/discussions/2349#discussioncomment-1722695
  web3ProviderTimeout: 30 * 1000
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
