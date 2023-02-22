import { KnownNetworkName } from './known-network-name';
import { KnownTokenName } from './known-token-name';

export interface KnownTokenConfig {
  name: KnownTokenName;
  maximumAllowedMintsPerAddress: number;
  address: string;
  network: KnownNetworkName;

  /**
   * used to limit queries, add the block number where the token was minted
   */
  firstBlockNumber: number;

  /**
   * implements IMosaic
   */
  implementsMosaics?: boolean;
}
