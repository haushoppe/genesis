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
  <title>Cube API</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">

  <link rel="icon" href="assets/cube.svg" type="image/x-icon">
  <link rel="stylesheet" href="assets/style.css" media="screen">
</head>

<body class="markdown-body">
  <h1>
    <img src="assets/cube.svg">
    Cube API
  </h1>

  <p>
    This is an internal API for the Collectors Cube project.
  </p>

  <ul>
    <li>
      <a href="/open-api">OpenAPI documentation</a>
    </li>
    <li>
      <a href="/open-api-json">OpenAPI JSON file</a>
    </li>
  </ul>
</html>`;

    return response.send(html);
  }

  // @Get()
  // getData() {
  //   return this.appService.getData();
  // }
}
