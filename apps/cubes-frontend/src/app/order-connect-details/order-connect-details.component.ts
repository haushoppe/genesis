import { AsyncPipe, DecimalPipe, JsonPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';

import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { MintFacade } from '../store/mint.facade';
import { environment } from '../../environments/environment';
import { BitcoinInscriptionService } from '../services/inscription-service';



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

  environment = environment;
}
