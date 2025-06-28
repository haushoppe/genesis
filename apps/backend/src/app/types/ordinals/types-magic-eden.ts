
/**
 * Options for fetching popular collections from Magic Eden's collection stats search endpoint.
 */
export interface GetCollectionStatisticsOptions {
  /**
   * Time window to aggregate stats. Defaults to '1d'.
   */
  window?: '1h' | '6h' | '1d' | '7d' | '30d';

  /**
   * Sort by which field. Defaults to 'volume'.
   */
  sort?: 'volume' | 'volumePercentageChange' | 'totalVolume'
        | 'sales' | 'salesPercentageChange' | 'totalSales'
        | 'floorPrice' | 'floorPricePercentageChange' | 'topOffer'
        | 'listedOverSupply' | 'ownerPercentage' | 'pending' | 'marketCap';

  /**
   * Sort direction. Defaults to 'desc'.
   */
  direction?: 'asc' | 'desc';

  /**
   * Result offset (pagination). Defaults to 0.
   * Allowed range: 0 to 1000.
   */
  offset?: number;

  /**
   * Number of collections to fetch. Defaults to 100.
   * Allowed range: 1 to 1000.
   */
  limit?: number;
}

/**
 * Results from the /collection_stats/search/bitcoin endpoint
 * see: https://docs.magiceden.io/reference/getcollectionstats-1
 * Return type is not documented, extracted from result
 *
 * Example:
 * GET
 *
 * ```
 * [
 *   {
 *     "cohort": "ordinal",
 *     "name": "NodeMonkes",
 *     "collectionSymbol": "nodemonkes",
 *     "collectionId": "nodemonkes",
 *     "vol": 0.64345002,
 *     "totalVol": 5510.11231137,
 *     "totalTxns": 24145,
 *     "volPctChg": -35.18362937,
 *     "txns": 9,
 *     "txnsPctChg": -78.57142857,
 *     "fp": 0.02499,
 *     "fpPctChg": 0.9696969696969537,
 *     "minted": 0,
 *     "mintedVol": 0,
 *     "fpListingPrice": 0.02499,
 *     "fpListingCurrency": "BTC",
 *     "highestGlobalOfferBidCurrency": "BTC",
 *     "marketCap": 249.89999999999998,
 *     "totalSupply": 10000,
 *     "listedCount": 1412,
 *     "ownerCount": 5083,
 *     "uniqueOwnerRatio": 0.5083,
 *     "image": "https://creator-hub-prod.s3.us-east-2.amazonaws.com/ord-nodemonkes_pfp_1733813805002.png",
 *     "isCompressed": false,
 *     "hasInscriptions": false,
 *     "currency": "BTC",
 *     "pending": 0,
 *     "currencyUsdRate": 107370.36450393237,
 *     "marketCapUsd": 26831854.0895327,
 *     "fpSparkLinePath": "/collection_stats/getCollectionSparkline/nodemonkes?cohort=ordinal&window=1d&currentFp=0.02499&fpPctChg=0.9696969696969537"
 *   }
 * ]
 * ```
 */
export interface GetCollectionStatisticsResult {
  cohort: string;
  name: string;
  collectionSymbol: string;
  symbol: string; // added for type-compatibilit with GetCollectionResult
  collectionId: string;
  vol: number;
  totalVol: number;
  totalTxns: number;
  volPctChg: number;
  txns: number;
  txnsPctChg: number;
  fp: number;
  fpPctChg: number;
  minted: number;
  mintedVol: number;
  fpListingPrice: number;
  fpListingCurrency: string;
  highestGlobalOfferBidCurrency: string;
  marketCap: number;
  totalSupply: number;
  listedCount: number;
  ownerCount: number;
  uniqueOwnerRatio: number;
  image: string;
  isCompressed: boolean;
  hasInscriptions: boolean;
  currency: string;
  pending: number;
  currencyUsdRate: number;
  marketCapUsd: number;
  fpSparkLinePath: string;
}

/**
 * Interface representing a single collection's details.
 * see: https://docs.magiceden.io/reference/getcollection-1
 *
 * Example:
 * GET https://api-mainnet.magiceden.dev/v2/ord/btc/collections/le_puppettes
 *
 * ```
 * {
 *   "symbol": "le_puppettes",
 *   "name": "le puppettes",
 *   "imageURI": "https://creator-hub-prod.s3.us-east-2.amazonaws.com/ord-le_puppettes_pfp_1710956432041.png",
 *   "chain": "btc",
 *   "inscriptionIcon": "",
 *   "description": "this is a btc puppets deriv project, made up of 6,969 puppettes. the collection includes traits that reference different btc projects, with the goal of becoming a well beloved representation of unhinged btc culture. there is only one utilititty - the art! while the btc puppets hang out in the shed (imagine the smell), the puppettes prefer the fresh air and stay outside in the garden. join us!",
 *   "supply": 6969,
 *   "twitterLink": "https://twitter.com/queenarf51621",
 *   "discordLink": "https://discord.gg/tMDjWyS7P6",
 *   "websiteLink": "",
 *   "createdAt": "Fri, 22 Mar 2024 00:40:01 GMT",
 *   "overrideContentType": "",
 *   "disableRichThumbnailGeneration": false,
 *   "disableRichDetailGeneration": null,
 *   "labels": [],
 *   "creatorTipsAddress": "bc1qwmfzd9mvzna63f8urrq53argzrjc7j3tmz66jj",
 *   "enableCollectionOffer": true
 * }
 * ```
 */
export interface GetCollectionResult {
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
  // min_inscription_number: number; // documented, but not in the result ???
  // max_inscription_number: number; // documented, but not in the result ???
  createdAt: string;
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

/**
 * Result from the Get tokens endpoint
 * see: https://docs.magiceden.io/reference/gettokens-1
 *
 * Warning! Documentation sais "items", but it's named "tokens" instead
 *
 * Example:
 * GET https://api-mainnet.magiceden.dev/v2/ord/btc/tokens?collectionSymbol=le_puppettes
 *
 * ```
 * {
 *   "tokens": [
 *     {
 *       "id": "06d5b7b9e3f6921f80c466f118935f5c1d010f415acda3571e153768917ddfb3i0",
 *       "contentURI": "https://ord-mirror.magiceden.dev/content/06d5b7b9e3f6921f80c466f118935f5c1d010f415acda3571e153768917ddfb3i0",
 *       "contentType": "image/png",
 *       "contentPreviewURI": "https://ord-mirror.magiceden.dev/preview/06d5b7b9e3f6921f80c466f118935f5c1d010f415acda3571e153768917ddfb3i0",
 *       "genesisTransaction": "06d5b7b9e3f6921f80c466f118935f5c1d010f415acda3571e153768917ddfb3",
 *       "genesisTransactionBlockTime": "Thu, 21 Mar 2024 20:33:21 GMT",
 *       "genesisTransactionBlockHash": "00000000000000000002f02ebf6609002251e8855308cf61fd72f7bc4c801bd2",
 *       "genesisTransactionBlockHeight": 835694,
 *       "inscriptionNumber": 65320762,
 *       "chain": "btc",
 *       "meta": {
 *         "name": "le puppettes #5386",
 *         "attributes": [
 *           {
 *             "value": "touch grass",
 *             "trait_type": "background"
 *           },
 *           {
 *             "value": "normie",
 *             "trait_type": "body"
 *           },
 *           {
 *             "value": "purple tank wif drip",
 *             "trait_type": "clothes"
 *           },
 *           {
 *             "value": "green sparkle",
 *             "trait_type": "ears"
 *           },
 *           {
 *             "value": "hi",
 *             "trait_type": "eyes"
 *           },
 *           {
 *             "value": "none",
 *             "trait_type": "facewear"
 *           },
 *           {
 *             "value": "lil grubby",
 *             "trait_type": "hand"
 *           },
 *           {
 *             "value": "down bad",
 *             "trait_type": "handitem"
 *           },
 *           {
 *             "value": "undies",
 *             "trait_type": "head"
 *           },
 *           {
 *             "value": "no hoodie",
 *             "trait_type": "hoodie"
 *           },
 *           {
 *             "value": "smile",
 *             "trait_type": "mouth"
 *           },
 *           {
 *             "value": "no smoke",
 *             "trait_type": "smoke"
 *           }
 *         ]
 *       },
 *       "location": "83fa37fb4e89fbb01218316c1dc392fa6881ed4c5c001a71a83553c26778d78a:4:0",
 *       "locationBlockHeight": 836018,
 *       "locationBlockTime": "Sun, 24 Mar 2024 01:30:30 GMT",
 *       "locationBlockHash": "00000000000000000002a472d9a20713e7edf2e07c3bdd87cbb0e7596e44775e",
 *       "output": "83fa37fb4e89fbb01218316c1dc392fa6881ed4c5c001a71a83553c26778d78a:4",
 *       "outputValue": 546,
 *       "owner": "bc1pwq00dxjvzgd5tqn0lsdw9d4y546zumlptrq6pyved322w426t33sglj8al",
 *       "listed": true,
 *       "listedAt": "Wed, 25 Jun 2025 15:53:43 GMT",
 *       "listedPrice": 9000,
 *       "listedMakerFeeBp": 50,
 *       "listedSellerReceiveAddress": "3DyS9cRd2JHSDENNCaJ1PkpALdPc9boDi3",
 *       "listedForMint": false,
 *       "collectionSymbol": "le_puppettes",
 *       "collection": {
 *         "symbol": "le_puppettes",
 *         "name": "le puppettes",
 *         "imageURI": "https://creator-hub-prod.s3.us-east-2.amazonaws.com/ord-le_puppettes_pfp_1710956432041.png",
 *         "chain": "btc",
 *         "inscriptionIcon": "",
 *         "description": "this is a btc puppets deriv project, made up of 6,969 puppettes. the collection includes traits that reference different btc projects, with the goal of becoming a well beloved representation of unhinged btc culture. there is only one utilititty - the art! while the btc puppets hang out in the shed (imagine the smell), the puppettes prefer the fresh air and stay outside in the garden. join us!",
 *         "supply": 6969,
 *         "twitterLink": "https://twitter.com/queenarf51621",
 *         "discordLink": "https://discord.gg/tMDjWyS7P6",
 *         "websiteLink": "",
 *         "createdAt": "Fri, 22 Mar 2024 00:40:01 GMT",
 *         "overrideContentType": "",
 *         "disableRichThumbnailGeneration": false,
 *         "labels": [],
 *         "creatorTipsAddress": "bc1qwmfzd9mvzna63f8urrq53argzrjc7j3tmz66jj",
 *         "enableCollectionOffer": true
 *       },
 *       "itemType": "Inscription",
 *       "sat": 1010376008159182,
 *       "satName": "grqunpwjvfn",
 *       "satRarity": "common",
 *       "satBlockHeight": 202075,
 *       "satBlockTime": "Sat, 06 Oct 2012 14:58:57 GMT",
 *       "satributes": [
 *         "Common"
 *       ],
 *       "displayName": "le puppettes #5386",
 *       "lastSalePrice": 225000,
 *       "updatedAt": "Wed, 25 Jun 2025 15:53:43 GMT",
 *       "sacAddress": "bc1p8ekqa3nehwka30vkxyaq5tcgje5uxcapfkxu49svcrevwurxdk2sysxv58",
 *       "sacMerkleTreeSize": 3681051,
 *       "hasTransientRbfProtection": true
 *     }
 * ]
 */
export interface GetTokensResponse {
  total: number;
  tokens: Token[]; // warning: wronly documented as "items" in the docs
}


export interface GetTokensOptions {
  tokenIds?: string[];
  collectionSymbol?: string;
  ownerAddress?: string;

  /**
   * Show all items including the listed and unlisted ones
   */
  showAll?: 'true' | 'false';
  limit?: number;
  offset?: number;
  inscriptionMin?: number;
  inscriptionMax?: number;

  /**
   * Defaults to priceAsc
   */
  sortBy?: 'priceAsc' | 'priceDesc' | 'listedAtAsc' | 'listedAtDesc' | 'inscriptionNumberAsc' | 'inscriptionNumberDesc' | 'brc20UnitPriceAsc' | 'brc20UnitPriceDesc';
  minPrice?: number;
  maxPrice?: number;
  satRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

  // not documented anymore
  // disablePendingTransactions?: 'true' | 'false';
}
