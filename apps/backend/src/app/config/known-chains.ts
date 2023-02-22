import { KnownNetworkName } from "../../../../shared/known-network-name"
import { Chain } from "./web3-onboard-chain"

export const KnownChains: { [key in KnownNetworkName]: Chain } = {
  [KnownNetworkName.hardhat]: {
    id: '0x1337',
    token: 'ETH',
    label: 'Hardhat Network',
    rpcUrl: `http://localhost:8545`,
    blockExplorerUrl: 'http://example.org'
  },
  [KnownNetworkName.goerli]: {
    id: '0x5',
    token: 'ETH',
    label: 'Goerli',
    rpcUrl: `https://eth-goerli.g.alchemy.com/v2/API_KEY`,
    blockExplorerUrl: 'https://goerli.etherscan.io'
  },
  [KnownNetworkName.mainnet]: {
    id: '0x1',
    token: 'ETH',
    label: 'Ethereum Mainnet',
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/API_KEY`,
    blockExplorerUrl: 'https://etherscan.io/'
  },
}
