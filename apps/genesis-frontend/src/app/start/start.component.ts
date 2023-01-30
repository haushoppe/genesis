import { AsyncPipe, JsonPipe, NgFor } from '@angular/common';
import { Component, HostBinding, inject } from '@angular/core';
import { map } from 'rxjs';

import { NftDisplayComponent } from '../nft-display/nft-display.component';
import { ApiService } from '../openapi-client';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    JsonPipe,
    NftDisplayComponent,
    NgFor
  ]
})
export class StartComponent {
  @HostBinding('class') class = 'px-3';

  latestMints$ = inject(ApiService).apiControllerAllMints('genesis').pipe(
    map(x => x.reverse())
  );

}
