import { KnownTokenName } from "../shared/known-token-name";

export const environment = {
  production: true,
  api: 'https://backend.haushoppe.art',
  tokenName: KnownTokenName.genesis,
  // You cannot set a timeout directly on a Web3Provider,
  // because there is not necessarily an underlying network connection.
  // For example, MetaMask is not something that can timeout, since it is an injected object.
  // see https://github.com/ethers-io/ethers.js/discussions/2349#discussioncomment-1722695
  web3ProviderTimeout: 2 * 60 * 1000
};
