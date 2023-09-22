import { JsonPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';

import { parseCube } from '../../../../shared/parse-cube';
import { environment } from '../../environments/environment';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { placeholderAsString } from '../layout/toggle-iframe.directive';
import { SafeHtmlPipe } from '../safe-html.pipe';
import { InscriptionParserService } from '../services/inscription-parser.service';
import { VinEntry } from '../services/mempool.service.transaction-details.types';
import { MintFacade } from '../store/mint.facade';


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
      SafeHtmlPipe,
      JsonPipe
    ]
})
export class OrderConnectDetailsComponent {

  mintFacade = inject(MintFacade);
  inscriptionParserService = inject(InscriptionParserService);

  environment = environment;

  getDecodedCube(firstVin: VinEntry | undefined) {

    if (!firstVin) {
      return placeholderAsString;
    }

    const inscription = this.inscriptionParserService.parseInscription(firstVin);
    const content = inscription.contentString;

    // only 100% valid cubes will be displayed here, for XSS security reasons
    if (!parseCube(content)) {
      return placeholderAsString;
    }

    return content;
  }
}
