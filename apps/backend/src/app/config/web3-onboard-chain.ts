export interface Chain {
  id: string // hex encoded string, eg '0x1' for Ethereum Mainnet
  token: string // the native token symbol, eg ETH, BNB, MATIC
  label: string // used for display, eg Ethereum Mainnet
  rpcUrl: string // used for network requests (eg Alchemy or Infura end point)

  color?: string // the color used to represent the chain and will be used as a background for the icon
  icon?: string // the icon to represent the chain
  publicRpcUrl?: string // an optional public RPC used when adding a new chain config to the wallet
  blockExplorerUrl?: string // also used when adding a new config to the wallet
}
