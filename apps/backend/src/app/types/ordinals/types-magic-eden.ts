/**
 * Interface for a single collection stat.
 */
export interface CollectionStat {
  symbol: string;
  name: string;
  imageURI: string;
  inscriptionIcon: string;
  collectionInscriptionId: null | string;
  description: string;
  twitterLink: string;
  discordLink: string;
  websiteLink: string;
  totalVolume: string;
  sales: string;
  salesInMempool: string;
  floorPrice: string;
  owners: string;
  supply: number;
}

/**
 * Options for fetching popular collections.
 */
export interface FetchPopularCollectionsOptions {
  window: '1h' | '6h' | '1d' | '7d' | '30d';

  // The limit value should be a multiple of 12.
  limit: number;
}

/**
 * Interface representing a single collection's details.
 */
export interface CollectionDetails {
  symbol: string;
  name: string;
  imageURI: string;
  chain: string;
  inscriptionIcon: string;
  description: string;
  supply: number;
  twitterLink: string;
  discordLink: string;
  websiteLink: string;
  createdAt: string;
  overrideContentType: string;
  disableRichThumbnailGeneration: boolean;
  labels: string[];
}

/**
 * Interface representing the stats of a specific collection.
 */
export interface CollectionStats {
  totalVolume: string;
  owners: string;
  supply: string;
  floorPrice: string;
  totalListed: string;
  pendingTransactions: string;
  inscriptionNumberMin: string;
  inscriptionNumberMax: string;
}

export interface TokenAttribute {
  value: string;
  trait_type: string;
}

export interface TokenCollection {
  symbol: string;
  name: string;
  imageURI: string;
  chain: string;
  inscriptionIcon: string;
  description: string;
  supply: number;
  twitterLink: string;
  discordLink: string;
  websiteLink: string;
  createdAt: string;
  overrideContentType: string;
  disableRichThumbnailGeneration: boolean;
  labels: any[];  // or a more specific type if you have one
}

export interface Token {
  id: string;
  contentURI: string;
  contentType: string;
  contentPreviewURI: string;
  genesisTransaction: string;
  genesisTransactionBlockTime: string;
  genesisTransactionBlockHash: string;
  genesisTransactionBlockHeight: number;
  inscriptionNumber: number;
  chain: string;
  meta: {
    name: string;
    attributes: TokenAttribute[];
  };
  location: string;
  locationBlockHeight: number;
  locationBlockTime: string;
  locationBlockHash: string;
  output: string;
  outputValue: number;
  owner: string;
  listed: boolean;
  listedAt: string;
  listedPrice: number;
  listedMakerFeeBp: number;
  listedSellerReceiveAddress: string;
  listedForMint: boolean;
  collectionSymbol: string;
  collection: TokenCollection;
  itemType: string;
  sat: number;
  satName: string;
  satRarity: string;
  satBlockHeight: number;
  satBlockTime: string;
  satributes: string[];
}

export interface FetchTokensResponse {
  total: number;
  tokens: Token[];
}

export interface FetchTokensOptions {
  tokenIds?: string[];
  collectionSymbol?: string;
  ownerAddress?: string;
  showAll?: 'true' | 'false';
  limit?: number;
  offset?: number;
  inscriptionMin?: number;
  inscriptionMax?: number;
  sortBy?: 'priceAsc' | 'priceDesc' | 'listedAtAsc' | 'listedAtDesc' | 'inscriptionNumberAsc' | 'inscriptionNumberDesc' | 'brc20UnitPriceAsc' | 'brc20UnitPriceDesc';
  minPrice?: number;
  maxPrice?: number;
  satRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  disablePendingTransactions?: 'true' | 'false';
}
