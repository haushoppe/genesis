import { DecimalPipe, JsonPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';
import { QRCodeModule } from 'angularx-qrcode';

import { parseCube } from '../../../../shared/ordinals/parse-cube';
import { environment } from '../../environments/environment';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { InscriptionOrder } from '../ordinalsbot';
import { SafeHtmlPipe } from '../safe-html.pipe';
import { MintFacade } from '../store/mint.facade';
import { getSubmittingState } from '../store/submittable/submittable-state';
import { decodeBase64DataURI } from './decode-base64-data-uri';


@Component({
    selector: 'app-order-details',
    templateUrl: './order-details.component.html',
    styleUrls: ['./order-details.component.scss'],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgIf,
        PushModule,
        JsonPipe,
        NgClass,
        LoadingIndicatorComponent,
        NgIf,
        QRCodeModule,
        LetModule,
        RouterLink,
        SafeHtmlPipe,
        DecimalPipe
    ]
})
export class OrderDetailsComponent {

  mintFacade = inject(MintFacade);
  environment = environment;

  submittingState = getSubmittingState();
  cd = inject(ChangeDetectorRef);

  showLightning = false;
  copyChainSuccessfull: boolean | undefined;
  copyAmountSuccessfull: boolean | undefined;
  copyPayreqSuccessfull: boolean | undefined;


  getLinkToChain(order: InscriptionOrder) {
    return 'bitcoin:' + order.charge.chain_invoice.address
      + '?amount=' + (order.charge.amount / 100000000)
      + '&label=cubes+order';
  }

  getLinkToLightning(order: InscriptionOrder) {
    return 'lightning:' + order.charge.lightning_invoice.payreq;
  }

  getDecodedCube(dataURL: string): string {
    if (!dataURL) return '';

    const decoded = decodeBase64DataURI(dataURL) || '';

    // only 100% valid cubes will be displayed here, for XSS security reasons
    if (!parseCube(decoded)) {
      return '';
    }

    return decoded;
  }

  async copyChainAddressToClipboard(order: InscriptionOrder) {
    try {
      await navigator.clipboard.writeText(order.charge.chain_invoice.address);
      this.copyChainSuccessfull = true;
    } catch {
      this.copyChainSuccessfull = false;
      console.error('Cant copy to clipboard!')
    }
    this.cd.detectChanges();
  }

  async copyAmountToClipboard(order: InscriptionOrder) {
    try {
      await navigator.clipboard.writeText((order.charge.amount / 100000000) + '');
      this.copyAmountSuccessfull = true;
    } catch {
      this.copyAmountSuccessfull = false;
      console.error('Cant copy to clipboard!')
    }
    this.cd.detectChanges();
  }

  async copyPayreqToClipboard(order: InscriptionOrder) {
    try {
      await navigator.clipboard.writeText(order.charge.lightning_invoice.payreq);
      this.copyPayreqSuccessfull = true;
    } catch {
      this.copyPayreqSuccessfull = false;
      console.error('Cant copy to clipboard!')
    }
    this.cd.detectChanges();
  }
}
