import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { CollectionDetails, CollectionStat, CollectionStats, FetchPopularCollectionsOptions, FetchTokensOptions, FetchTokensResponse } from '../../types/ordinals/types-magic-eden';


@Injectable()
export class MagicEdenService {

  private apiClient: AxiosInstance;

  constructor(private configService: ConfigService) {
    const bearerToken = this.configService.get<string>('MAGIC_EDEN_API_KEY');

    this.apiClient = axios.create({
      baseURL: 'https://api-mainnet.magiceden.dev/v2/ord',
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${bearerToken}`
      }
    });

    // this.apiClient.interceptors.request.use(request => {
    //   console.log('Starting Request:', JSON.stringify(request, null, 2));
    //   return request;
    // });
  }

  /**
   * Fetches popular collection stats from MagicEden.
   *
   * @param options - Options for the fetch (window and limit).
   * @returns A promise that resolves to an array of popular collection stats.
   */
  async fetchPopularCollections(options: FetchPopularCollectionsOptions): Promise<CollectionStat[]> {

    if (!(options.limit % 12 === 0)) {
      console.warn('The limit value should be a multiple of 12!');
    }

    const response = await this.apiClient.get<CollectionStat[]>('/btc/popular_collections', {
      params: options
    });

    return response.data;
  }

  /**
   * Fetches ALL (!!!) collections from MagicEden
   *
   * @param collectionSymbol - The symbol representing the specific collection.
   * @returns A promise that resolves to the details of the requested collection.
   */
  async fetchAllCollectionsDetails(): Promise<CollectionDetails> {

    const response = await this.apiClient.get<CollectionDetails>(`/btc/collections`);
    return response.data;
  }

  /**
   * Fetches details of a specific collection from MagicEden using the collection symbol.
   *
   * @param collectionSymbol - The symbol representing the specific collection.
   * @returns A promise that resolves to the details of the requested collection.
   */
  async fetchCollectionDetails(collectionSymbol: string): Promise<CollectionDetails> {
    if (!collectionSymbol) {
      throw new Error('Symbol is required to fetch collection details.');
    }

    const response = await this.apiClient.get<CollectionDetails>(`/btc/collections/${collectionSymbol}`);
    return response.data;
  }

  /**
   * Fetches statistics of a specific collection from MagicEden using the collection symbol.
   *
   * @param collectionSymbol - The symbol representing the specific collection for which stats are to be fetched.
   * @returns A promise that resolves to the statistics of the requested collection.
   */
  async fetchCollectionStats(collectionSymbol: string): Promise<CollectionStats> {
    if (!collectionSymbol) {
      throw new Error('Collection symbol is required to fetch collection statistics.');
    }

    const response = await this.apiClient.get<CollectionStats>('/btc/stat', {
      params: { collectionSymbol }
    });
    return response.data;
  }

    /**
   * Fetches tokens from MagicEden based on the provided options.
   * !! collectionSymbols, ownerAddresses, inscriptionMin/inscriptionMax, satRarity or tokenId is required!
   *
   * @param options - Options for fetching tokens.
   * @returns A promise that resolves to a FetchTokensResponse containing the list of tokens and total count.
   */
    async fetchTokens(options: FetchTokensOptions): Promise<FetchTokensResponse> {
      const response = await this.apiClient.get<FetchTokensResponse>('/btc/tokens', {
        params: options
      });

      return response.data;
    }
}
