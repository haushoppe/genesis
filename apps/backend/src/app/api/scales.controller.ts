import { Controller, Get, Logger, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import axios from 'axios';


@ApiTags('scales')
@Controller()
export class ScalesController {

  // TODO: outdated!
  readonly mongodbRestEndpoint = this.configService.get('mongodbRestEndpoint');
  readonly mongodbApiKey = this.configService.get('mongodbApiKey');
  readonly restApiConfig = {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
      'api-key': this.mongodbApiKey
    }
  }

  constructor(private configService: ConfigService) { }

  /**
   * Returns the single NFT with the given ID
   */
  @ApiParam({
    name: 'token_id',
    description: 'The ID of the NFT',
    example: '333'
  })
  @Get(['scales/getSingle/:token_id'])
  async getSingle(@Param('token_id') token_id: string) {

    // Logger.verbose("Serving api/getSingle/" + token_id);

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
  @Get(['scales/getAll'])
  async getAll() {

    // Logger.verbose("Serving api/getAll/");

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
}
