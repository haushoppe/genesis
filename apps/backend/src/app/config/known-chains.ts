import { KnownNetworkName } from "../../../../shared/known-network-name"
import { Chain } from "./chain"


// see https://github.com/blocknative/web3-onboard/core/src/utils.ts


export const KnownChains: { [key in KnownNetworkName]: Chain } = {
  [KnownNetworkName.hardhat]: {
    // chainId: 1337, see https://hardhat.org/hardhat-network/docs/metamask-issue#metamask-chainid-issue
    id: `0x${(1337).toString(16)}`,
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
