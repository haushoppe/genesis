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
  <title>Scales Dashboard API</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">

  <!--<link rel="icon" href="assets/XXX.svg" type="image/x-icon">-->
  <link rel="stylesheet" href="assets/style.css" media="screen">
</head>

<body class="markdown-body">
  <h1>
    Scales Dashboard API
  </h1>

  <p>
    This is an internal API.
  </p>

  <ul>
    <li>
      <a href="/open-api">OpenAPI documentation</a>
    </li>
    <!--<li>
      <a href="/open-api-json">OpenAPI JSON file</a>
    </li>-->
  </ul>
</html>`;

    return response.send(html);
  }
}
