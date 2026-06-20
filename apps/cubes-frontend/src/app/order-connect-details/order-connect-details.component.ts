import { RxPush } from '@rx-angular/template/push';
import { RxLet } from '@rx-angular/template/let';
import { JsonPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { parseCube } from '../../shared/ordinals/parse-cube';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RxPush,
    NgClass,
    LoadingIndicatorComponent,
    RxLet,
    RouterLink,
    SafeHtmlPipe,
    JsonPipe,
  ],
})
export class OrderConnectDetailsComponent {
  mintFacade = inject(MintFacade);
  inscriptionParserService = inject(InscriptionParserService);

  environment = environment;

  getDecodedCube(firstVin: VinEntry | undefined) {
    if (!firstVin) {
      return placeholderAsString;
    }

    const inscription =
      this.inscriptionParserService.parseInscription(firstVin);
    const content = inscription.contentString;

    // only 100% valid cubes will be displayed here, for XSS security reasons
    if (!parseCube(content)) {
      return placeholderAsString;
    }

    return content;
  }
}
