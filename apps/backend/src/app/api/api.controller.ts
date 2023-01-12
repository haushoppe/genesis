import { Body, Controller, Get, Logger, NotFoundException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MintTicket } from '../model/mint-ticket';
import { MintRequest } from '../model/mint-request';
import { encodePackedMessage, getSigner, hashMessage, signMessage } from '../model/utils';


@ApiTags('api')
@Controller()
export class ApiController {

  private readonly knownTokens = ['genesis', 'mosaic', 'sea', 'art', 'artist', 'cube'];

  constructor(private config: ConfigService) { }

  /**
   * Minting via allowlist
   *
   * Allow for minting of tokens up to the maximum allowed for a given address.
   * The address of the sender and the number of mints allowed are hashed and signed
   * with the server's private key and verified on-chain to prove allowlist status.
   */
  @Post(['api/mintAllowlist'])
  @ApiNotFoundResponse({ description: 'Unkown token name!'})
  @ApiForbiddenResponse({ description: 'The sender is not on the allowlist!'})
  @ApiOkResponse({
    description: 'The required params to execute the mint',
    type: MintTicket
  })
  async mintAllowlist(@Body() mintRequest: MintRequest): Promise<MintTicket> {

    Logger.verbose(`Mint request for token ${mintRequest.token} from sender ${mintRequest.sender}`);

    if (!this.knownTokens.includes(mintRequest.token)) {
      throw new NotFoundException('Unknown token name: ' + mintRequest.token);
    }

    const privateKey = this.config.get('signerKey_' + mintRequest.token);
    const signer = getSigner(privateKey);
    const sender = mintRequest.sender;
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
      uptime: this.formatSeconds(process.uptime()),
      signers: this.knownTokens.map(token => ({
        name: token,
        address: getSigner(this.config.get('signerKey_' + token)).address }))
    };
  }

  private formatSeconds(seconds: number) {
    const pad = function (s: number) {
      return (s < 10 ? '0' : '') + s;
    }
    const hours = Math.floor(seconds / (60 * 60));
    const minutes = Math.floor(seconds % (60 * 60) / 60);
    const secs = Math.floor(seconds % 60);

    return pad(hours) + ':' + pad(minutes) + ':' + pad(secs);
  }
}
