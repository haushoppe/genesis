import { Body, Controller, ForbiddenException, Get, Logger, NotFoundException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { AllowlistService } from '../model/allowlist.service';
import { formatSeconds } from '../model/date-utils';
import { encodePackedMessage, getSigner, hashMessage, signMessage } from '../model/ethers-utils';
import { KnownToken } from '../model/known-token';
import { MintRequest } from '../model/mint-request';
import { MintTicket } from '../model/mint-ticket';


@ApiTags('api')
@Controller()
export class ApiController {

  knownTokens: KnownToken[] = this.config.get('knownTokens');

  constructor(private config: ConfigService, private allowlist: AllowlistService) { }

  /**
   * Minting via allowlist
   *
   * Allow for minting of tokens up to the maximum allowed for a given address.
   * The address of the sender and the number of mints allowed are hashed and signed
   * with the server's private key and verified on-chain to prove allowlist status.
   */
  @Post(['api/mintAllowlist'])
  @ApiNotFoundResponse({ description: 'Unkown token name' })
  @ApiForbiddenResponse({ description: 'The sender is not on the allowlist' })
  @ApiOkResponse({
    description: 'The required params to execute the mint',
    type: MintTicket
  })
  async mintAllowlist(@Body() mintRequest: MintRequest): Promise<MintTicket> {

    const tokenName = mintRequest.tokenName;
    const sender = mintRequest.sender.toLowerCase();

    Logger.verbose(`Mint request for token ${tokenName} from sender ${sender}`);

    if (!this.knownTokens.map(x => x.name).includes(tokenName)) {
      throw new NotFoundException('Unknown token name');
    }

    if (sender === '0x0000000000000000000000000000000000000000') {
      throw new ForbiddenException('The zero address is not a valid sender');
    }

    const mintWallets = this.allowlist.getMintWallets(tokenName);
    if (!mintWallets.includes(sender)) {
      throw new ForbiddenException('The sender is not on the allowlist');
    }

    const privateKey = this.config.get('signerKey_' + tokenName);
    const signer = getSigner(privateKey);
    const maximumAllowedMints = 4;

    const message = encodePackedMessage(sender, maximumAllowedMints);
    const messageHash = hashMessage(message);
    const signature = await signMessage(signer, messageHash);

    return {
      messageHash,
      signature,
      maximumAllowedMints
    };
  }

  /**
   * Status of this service
   */
  @Get(['api/status'])
  async getStatus() {
    return {
      environment: this.config.get('environment'),
      uptime: formatSeconds(process.uptime()),
      knownTokens: this.knownTokens.map(token => ({
        name: token.name,
        address: token.address,
        etherscanLink: (this.config.get('environment') === 'development' ?
          'https://goerli.etherscan.io/address/' :
          'https://etherscan.io/address/') + token.address,
        signer: getSigner(this.config.get('signerKey_' + token.name)).address,
        maximumAllowedMintsPerAddress: token.maximumAllowedMintsPerAddress,
        allowlistEntries: this.allowlist.getMintWallets(token.name).length
      }))
    };
  }
}
