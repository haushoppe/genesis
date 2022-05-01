// made my own types for the OpenApi CLI Plugin
// see https://docs.nestjs.com/openapi/cli-plugin#using-the-cli-plugin

// source for the types:
// node_modules/moralis/types/generated/web3Api.d.ts

export class NftCollection {

  /**
   * The total number of matches for this query
   * @example 2000
   */
  total?: number;

  /**
   * The page of the current result
   * @example 2
   */
  page?: number;

  /**
   * The number of results per page
   * @example 100
   */
  page_size?: number;

  /** The cursor to get to the next page */
  cursor?: string;

  result?: NFT[];
};


export class NFT {

  /**
   * The address of the contract of the NFT
   * @example 0x057Ec652A4F150f7FF94f089A38008f49a0DF88e
   */
  token_address: string;

  /**
   * The token id of the NFT
   * @example 15
   */
  token_id: string;

  /**
   * The type of NFT contract standard
   * @example ERC721
   */
  contract_type: string;

  /** The uri to the metadata of the token */
  token_uri?: string;

  // /** The metadata of the token (unparsed JSON) */
  metadata?: string;

  /** when the metadata was last updated */
  synced_at?: string;

  /**
   * The number of this item the user owns (used by ERC1155)
   * @example 1
   */
  amount?: string;

  /**
   * The name of the Token contract
   * @example CryptoKitties
   */
  name: string;

  /**
   * The symbol of the NFT contract
   * @example RARI
   */
  symbol: string;
};


export class ParsedNFT extends NFT {

  /**
   * The address of the contract of the NFT
   * @example 0x057Ec652A4F150f7FF94f089A38008f49a0DF88e
   */
   token_address: string;

   /**
    * The token id of the NFT
    * @example 15
    */
   token_id: string;

   /**
    * The type of NFT contract standard
    * @example ERC721
    */
   contract_type: string;

   /** The uri to the metadata of the token */
   token_uri?: string;

   // /** The metadata of the token (parsed JSON) */
   metadata?: any;

   /** when the metadata was last updated */
   synced_at?: string;

   /**
    * The number of this item the user owns (used by ERC1155)
    * @example 1
    */
   amount?: string;

   /**
    * The name of the Token contract
    * @example CryptoKitties
    */
   name: string;

   /**
    * The symbol of the NFT contract
    * @example RARI
    */
   symbol: string;

}

