import { KnownNetworkName } from '../../../../shared/known-network-name';
import { KnownTokenName } from '../../../../shared/known-token-name';

export interface KnownTokenConfig {
  name: KnownTokenName;
  maximumAllowedMintsPerAddress: number;
  contractAddress: string;
  networkName: KnownNetworkName;

  /**
   * used to limit queries, add the block number where the token was minted
   */
  firstBlockNumber: number;

  /**
   * implements IMosaic
   */
  implementsMosaics?: boolean;
}
