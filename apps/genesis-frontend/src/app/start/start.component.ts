import { AsyncPipe, JsonPipe, NgFor } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map, retry } from 'rxjs';

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

  latestMints$ = inject(ApiService).apiControllerAllMints('genesis').pipe(
    map(x => x.reverse()),
    retry({ delay: 1000 })
  );

}
