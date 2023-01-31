import { AsyncPipe, JsonPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map, retry, tap } from 'rxjs';

import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { NftDisplayListComponent } from '../nft-display-list/nft-display-list.component';
import { ApiService } from '../openapi-client';

@Component({
    selector: 'app-start',
    templateUrl: './start.component.html',
    styleUrls: ['./start.component.scss'],
    standalone: true,
    imports: [
      AsyncPipe,
      JsonPipe,
      LoadingIndicatorComponent,
      NftDisplayListComponent,
      NgFor,
      NgIf
    ]
})
export class StartComponent {

  loading = false;

  latestMints$ = inject(ApiService).apiControllerAllMints('genesis').pipe(
    tap(() => this.loading = true),
    map(x => x.reverse()),
    retry({ delay: 1000 }),
    tap(() => this.loading = false)
  );

}
