import { AsyncPipe, DecimalPipe, JsonPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';

import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { MintFacade } from '../store/mint.facade';
import { environment } from '../../environments/environment';
import { BitcoinInscriptionService } from '../services/bitcoin-inscription-service';
import { decodeBase64DataURI } from '../order-details/decode-base64-data-uri';



@Component({
    selector: 'app-order-connect-details',
    templateUrl: './order-connect-details.component.html',
    styleUrls: ['./order-connect-details.component.scss'],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
      NgIf,
      PushModule,
      NgClass,
      LoadingIndicatorComponent,
      NgIf,
      LetModule,
      RouterLink,
      DecimalPipe,
      JsonPipe,
      AsyncPipe
    ]
})
export class OrderConnectDetailsComponent {

  mintFacade = inject(MintFacade);
  bitcoinInscriptionService = inject(BitcoinInscriptionService);

  data = '';
  decoded = '';

  environment = environment;

  constructor(route: ActivatedRoute, cd: ChangeDetectorRef) {

    // const txId = route.snapshot.paramMap.get('txId') || '';
    // this.bitcoinInscriptionService.getInscription(txId).then(data =>  {
    //   this.data = data;
    //   this.decoded = decodeBase64DataURI(data) || '';
    //   cd.detectChanges();
    // });
  }
}
