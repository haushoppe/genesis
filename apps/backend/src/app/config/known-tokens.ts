import { KnownTokenConfig } from "./known-token-config";
import { KnownTokenName } from "../../../../shared/known-token-name";
import { KnownNetworkName } from "../../../../shared/known-network-name";


export const knownTokens: KnownTokenConfig[] = [
  {
    name: KnownTokenName.genesis,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    networkName: KnownNetworkName.hardhat,
    firstBlockNumber: 0,
    implementsLendable: true,
    implementsMosaics: true
  },
  {
    name: KnownTokenName.mosaic,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    networkName: KnownNetworkName.hardhat,
    firstBlockNumber: 0,
    implementsLendable: true,
    implementsMosaics: true
  },
  {
    name: KnownTokenName.sea,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    networkName: KnownNetworkName.hardhat,
    firstBlockNumber: 0,
    implementsLendable: true
  },
  {
    name: KnownTokenName.art,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    networkName: KnownNetworkName.hardhat,
    firstBlockNumber: 0,
    implementsLendable: true
  },
  {
    name: KnownTokenName.artist,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    networkName: KnownNetworkName.hardhat,
    firstBlockNumber: 0,
    implementsLendable: true
  },
  {
    name: KnownTokenName.cube,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    networkName: KnownNetworkName.hardhat,
    firstBlockNumber: 0,
    implementsLendable: true
  },

  // goerli testnet
  {
    name: KnownTokenName.genesis,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x728265b4DD95E502EC46CF18E06787c57b473482',
    networkName: KnownNetworkName.goerli,
    firstBlockNumber: 8240212,
    implementsLendable: true,
    implementsMosaics: true
  },
  {
    name: KnownTokenName.mosaic,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x9d0C0eC7f18A7D017f716a602E8991640412E07f',
    networkName: KnownNetworkName.goerli,
    firstBlockNumber: 8240308,
    implementsLendable: true,
    implementsMosaics: true
  },
  {
    name: KnownTokenName.sea,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x3E1a35F35fCBb302EEBAD8D8c59aB0369065696E',
    networkName: KnownNetworkName.goerli,
    firstBlockNumber: 8240402,
    implementsLendable: true
  },
  {
    name: KnownTokenName.art,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xBF79e5797dd766288F7831689EF943b286f92d86',
    networkName: KnownNetworkName.goerli,
    firstBlockNumber: 8240950,
    implementsLendable: true
  },
  {
    name: KnownTokenName.artist,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x7dD31A2F91860E6cD82ba29D5C6c2497ea427ba6',
    networkName: KnownNetworkName.goerli,
    firstBlockNumber: 8239512,
    implementsLendable: true
  },
  {
    name: KnownTokenName.cube,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xB50f1A5149a68C1f27b4de2FC3aDC05A8410dA5D',
    networkName: KnownNetworkName.goerli,
    firstBlockNumber: 8239852,
    implementsLendable: true
  },

  // ethereum mainnet!
  {
    name: KnownTokenName.genesis,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xBF79e5797dd766288F7831689EF943b286f92d86',
    networkName:  KnownNetworkName.mainnet,
    firstBlockNumber: 16314164,
    implementsLendable: true,
    implementsMosaics: true
  },
  {
    name: KnownTokenName.mosaic,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xa8af731F0513DA720691d423d0a6C839Ab5d4a22',
    networkName: KnownNetworkName.mainnet,
    firstBlockNumber: 16314313,
    implementsLendable: true,
    implementsMosaics: true
  },
  {
    name: KnownTokenName.sea,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xf05A5D8d9DCf1BB1D33B09322Cc52df320A04fC5',
    networkName: KnownNetworkName.mainnet,
    firstBlockNumber: 16314834,
    implementsLendable: true
  },
  {
    name: KnownTokenName.art,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0xb40889c9fac33cd7684D3C9B14490EeE29a84761',
    networkName: KnownNetworkName.mainnet,
    firstBlockNumber: 16315111,
    implementsLendable: true
  },
  {
    name: KnownTokenName.artist,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x034F95d5EF960567e02af0Ac8C648288ad0b6691',
    networkName: KnownNetworkName.mainnet,
    firstBlockNumber: 16313333,
    implementsLendable: true
  },
  {
    name: KnownTokenName.cube,
    maximumAllowedMintsPerAddress: 4,
    contractAddress: '0x3E1a35F35fCBb302EEBAD8D8c59aB0369065696E',
    networkName: KnownNetworkName.mainnet,
    firstBlockNumber: 16313800,
    implementsLendable: true
  }
];
