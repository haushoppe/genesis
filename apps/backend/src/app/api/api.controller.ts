import { Controller, Get, Param, Response, StreamableFile } from '@nestjs/common';
import { Response as Res } from 'express';
import { ApiParam, ApiProperty } from '@nestjs/swagger';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MongoClient } = require("mongodb");
import { ConfigService } from '@nestjs/config';



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

  // /**
  //  * Getting the scales (via MongoClient -- does not work)
  //  */
  //  @Get(['api/test1'])
  // async getTest1() {

  //   const uri = "mongodb+srv://kay:myRealPassword@cluster0.mongodb.net/test?w=majority"; // ???!
  //   const client = new MongoClient(uri);
  //     try {
  //       await client.connect();
  //       const database = client.db('scales');
  //       const scales = database.collection('scales');

  //       const query = { _id: 1 };
  //       const scale = await scales.findOne(query);
  //       console.log(scale);

  //     } catch(ex) {
  //       console.dir(ex)

  //     } finally {
  //       await client.close();
  //     }
  // }

  /**
   * Test: Returns the single NFT with the given ID
   */
   @ApiParam({
    name: 'id',
    description: 'The ID of the NFT',
    example: '333'
  })
  @Get(['api/getSingle/:id'])
  async getSingle(@Param('id') id: string) {

    console.log("ID", id)

    const response = await axios.post(
      // https://www.mongodb.com/docs/manual/reference/method/db.collection.findOne/
      this.mongodbRestEndpoint + 'findOne',
      {
        collection: 'scales',
        database: 'scales',
        dataSource: 'mongodb-eth-1',
        filter: {
          id: id
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

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary')

    res.set({
      'content-type': response.headers['content-type'],
      'cache-control': 'public, max-age=29030400, immutable' // 4 weeks: 60 * 60 * 24 * 7 * 4 * 12 = 29030400
    });

    return new StreamableFile(buffer);
  }
}
