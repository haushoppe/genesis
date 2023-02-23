import { AsyncPipe, JsonPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map, retry, tap } from 'rxjs';
import { AlertComponent } from '../layout/alert-danger/alert.component';

import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { NftDisplayListComponent } from '../nft-display-list/nft-display-list.component';
import { ApiService } from '../openapi-client';
import { MintService } from '../shared/mint-service';

@Component({
    selector: 'app-start',
    templateUrl: './start.component.html',
    styleUrls: ['./start.component.scss'],
    standalone: true,
    imports: [
      AsyncPipe,
      JsonPipe,
      LoadingIndicatorComponent,
      AlertComponent,
      NftDisplayListComponent,
      NgFor,
      NgIf
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StartComponent {

  mintService = inject(MintService);
  loading = false;

  latestMints$ = inject(ApiService).allMints('genesis').pipe(
    tap(() => this.loading = true),
    map(x => x.reverse()),
    retry({ delay: 1000 }),
    tap(() => this.loading = false)
  );

}
