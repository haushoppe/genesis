import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import * as express from 'express';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiExcludeEndpoint()
  getStart(@Res() response: express.Response) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>🎨 NFT API</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">
  <link rel="stylesheet" href="assets/style.css" media="screen">
</head>

<body class="markdown-body">
  <h1>
    🎨 NFT API
  </h1>

  <p>
    This is an internal API. There is not much to see here.
  </p>

  <ul>
    <li>
      <a href="/open-api">OpenAPI UI</a>
    </li>
    <li>
      <a href="/open-api-json">OpenAPI specification</a>
    </li>
  </ul>
</html>`;

    return response.send(html);
  }

  @Get('/robots.txt')
  @ApiExcludeEndpoint()
  getRobotsTxt(@Res() response: express.Response) {
    response.setHeader('Content-Type', 'text/plain',);
    return response.send('User-agent: *\nDisallow: /');
  }
}
