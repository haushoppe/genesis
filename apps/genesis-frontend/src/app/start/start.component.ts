import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component, HostBinding, inject } from '@angular/core';

import { ApiService } from '../../../../../libs/openapi-client';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    JsonPipe
  ]
})
export class StartComponent {
  @HostBinding('class') class = 'px-3';

  latestMints$ = inject(ApiService).apiControllerAllMints('genesis');

}
