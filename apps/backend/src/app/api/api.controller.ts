import { Body, Controller, ForbiddenException, Get, Logger, NotFoundException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { AllowlistService } from '../model/allowlist.service';
import { ContractService } from '../model/contract.service';
import { formatSeconds } from '../model/date-utils';
import { encodePackedMessage, getSigner, hashMessage, signMessage } from '../model/ethers-utils';
import { KnownTokenConfig } from '../model/known-token-config';
import { KnownTokenName } from '../model/known-token-name';
import { MintRequest } from '../model/mint-request';
import { MintTicket } from '../model/mint-ticket';


@ApiTags('api')
@Controller()
export class ApiController {

  private knownTokens = this.config.get<KnownTokenConfig[]>('knownTokens');

  constructor(
    private config: ConfigService,
    private allowlist: AllowlistService,
    private contract: ContractService) { }

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
  @ApiParam({
    name: 'tokenName',
    description: 'Limits the contract details to one token',
    enum: ['all', ...Object.keys(KnownTokenName)],
    example: KnownTokenName.genesis,
  })
  @Get(['api/status/:tokenName'])
  async getStatus(@Param('tokenName') tokenName: 'all' | KnownTokenName) {

    let knownTokens = this.knownTokens;

    if (tokenName !== 'all') {
      knownTokens = [knownTokens.find(x => x.name === tokenName)];
    }

    return {
      environment: this.config.get('environment'),
      uptime: formatSeconds(process.uptime()),
      network: this.config.get('network'),
      knownTokens: await Promise.all(knownTokens.map(async token => ({
        name: token.name,
        address: token.address,
        etherscanLink: (this.config.get('network') === 'goerli' ?
          'https://goerli.etherscan.io/address/' :
          'https://etherscan.io/address/') + token.address,
        signer: getSigner(this.config.get('signerKey_' + token.name)).address,
        maximumAllowedMintsPerAddress: token.maximumAllowedMintsPerAddress,
        allowlistEntries: this.allowlist.getMintWallets(token.name).length,
        contractName: (await this.contract.getName(token.name)),
        totalSupply: (await this.contract.getTotalSupply(token.name))
      })))
    };
  }

  /**
   * Only for debugging, will not be exposed on production
   */
    @ApiParam({
      name: 'tokenName',
      enum: KnownTokenName,
      example: KnownTokenName.genesis,
    })
    @Get(['api/getAllMints/:tokenName'])
    @ApiExcludeEndpoint(process.env.NODE_ENV !== 'development')
    async getAllMints(@Param('tokenName') tokenName: KnownTokenName) {

      if (this.config.get('environment') !== 'development') {
        throw new ForbiddenException('This method should not be called on production');
      }

      return await this.contract.getAllMints(tokenName);
    }
}
