export enum KnownNetworkName {
  hardhat = 'hardhat',
  goerli = 'goerli',
  mainnet = 'mainnet'
}

export const explorerLinks: { [key in KnownNetworkName]: string } = {
  [KnownNetworkName.hardhat]: '?',
  [KnownNetworkName.goerli]: 'https://goerli.etherscan.io/address/',
  [KnownNetworkName.mainnet]: 'https://etherscan.io/address/',
}
