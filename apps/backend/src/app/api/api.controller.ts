import { Controller, Get, Param, Response, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiParam } from '@nestjs/swagger';
import axios from 'axios';
import { Response as Res } from 'express';
import { Logger } from '@nestjs/common';


@Controller()
export class ApiController {

  readonly mongodbRestEndpoint = this.config.get('mongodbRestEndpoint');
  readonly mongodbApiKey = this.config.get('mongodbApiKey');
  readonly restApiConfig = {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
      'api-key': this.mongodbApiKey
    }
  }

  constructor(private config: ConfigService) { }

  /**
   * Test: Returns the single NFT with the given ID
   */
   @ApiParam({
    name: 'token_id',
    description: 'The ID of the NFT',
    example: '333'
  })
  @Get(['api/getSingle/:token_id'])
  async getSingle(@Param('token_id') token_id: string) {

    Logger.verbose("Serving api/getSingle/" + token_id);

    const response = await axios.post(
      // https://www.mongodb.com/docs/manual/reference/method/db.collection.findOne/
      this.mongodbRestEndpoint + 'findOne',
      {
        collection: 'scales',
        database: 'scales',
        dataSource: 'mongodb-eth-1',
        filter: {
          token_id: +token_id,
        },
        projection: {
          // '_id': 1
        }
      },
      this.restApiConfig
    );

    return response.data.document;
  }

  /**
   * Returns all data we have
   */
  @Get(['api/getAll'])
  async getAll() {

    Logger.verbose("Serving api/getAll/");

    const response = await axios.post(
      // https://www.mongodb.com/docs/manual/reference/method/db.collection.find/
      this.mongodbRestEndpoint + 'find',
      {
        collection: 'scales',
        database: 'scales',
        dataSource: 'mongodb-eth-1',
        projection: {}
      },
      this.restApiConfig
    );

    return response.data.documents;
  }


  /**
   * Super simple HTTP proxy to work around CORS issues
   */
  @Get(['api/proxy/:url'])
  @ApiParam({
    name: 'url',
    description: 'The full URL to request',
    example: 'https://cloudflare-ipfs.com/ipfs/QmYKabnBxtucct5Vkf81o9ZX6u2sCnZKU94VfGqUwzbZwg'
  })
  async getProxy(@Param('url') url: string, @Response({ passthrough: true }) res: Res): Promise<StreamableFile> {

    Logger.verbose("Serving api/proxy/" + url);

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary')

    res.set({
      'content-type': response.headers['content-type'],
      'cache-control': 'public, max-age=29030400, immutable' // 4 weeks: 60 * 60 * 24 * 7 * 4 * 12 = 29030400
    });

    return new StreamableFile(buffer);
  }
}
