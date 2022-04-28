import { Controller, Get, Req, Res, All } from '@nestjs/common';
import * as express from 'express';


@Controller()
export class ApiController {

  @Get(['api/hello-world'])
  getData() {
    return {
      hello: 'world'
    }
  }
}
