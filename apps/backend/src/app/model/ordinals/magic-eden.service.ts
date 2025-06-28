import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { GetCollectionResult, GetCollectionStatisticsResult, GetCollectionStatisticsOptions, GetTokensOptions, GetTokensResponse } from '../../types/ordinals/types-magic-eden';


@Injectable()
export class MagicEdenService {

  private apiClient: AxiosInstance;

  constructor(private configService: ConfigService) {
    const bearerToken = this.configService.get<string>('MAGIC_EDEN_API_KEY');

    this.apiClient = axios.create({
      baseURL: 'https://api-mainnet.magiceden.dev',
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
   * Fetches a list of collection statistics from Magic Eden's collection statistics search endpoint.
   * https://docs.magiceden.io/reference/getcollectionstats-1
   * GET https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin
   *
   * @param options - Options to control the query (window, sort, direction, offset, limit).
   * @returns A promise resolving to a list of collection statistics.
   */
  async getCollectionStatistics(options: GetCollectionStatisticsOptions = {}): Promise<GetCollectionStatisticsResult[]> {
    const response = await this.apiClient.get<GetCollectionStatisticsResult[]>(
      '/collection_stats/search/bitcoin',
      { params: options }
    );

    return response.data.map(x => ({
        ...x,
       symbol: x.collectionSymbol
    }));
  }

  /**
   * Fetches details of a specific collection from MagicEden using the collection symbol.
   * see https://docs.magiceden.io/reference/getcollection-1
   * GET https://api-mainnet.magiceden.dev/v2/ord/btc/collections/{symbol}
   *
   * @param collectionSymbol - The symbol representing the specific collection.
   * @returns A promise that resolves to the details of the requested collection.
   */
  async getCollection(collectionSymbol: string): Promise<GetCollectionResult> {
    if (!collectionSymbol) {
      throw new Error('Symbol is required to fetch collection details.');
    }

    const response = await this.apiClient.get<GetCollectionResult>(`/v2/ord/btc/collections/${collectionSymbol}`);
    return response.data;
  }


  /**
   * Fetches tokens from MagicEden based on the provided options.
   * !! collectionSymbols, ownerAddresses, inscriptionMin/inscriptionMax, satRarity or tokenId is required!
   *
   * @param options - Options for fetching tokens.
   * @returns A promise that resolves to a FetchTokensResponse containing the list of tokens and total count.
   */
  async getTokens(options: GetTokensOptions): Promise<GetTokensResponse> {
    const response = await this.apiClient.get<GetTokensResponse>('/v2/ord/btc/tokens', {
      params: options
    });

    return response.data;
  }
}
