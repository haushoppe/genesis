import { JsonPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input } from '@angular/core';
import { PushModule } from '@rx-angular/template/push';
import { QRCodeModule } from 'angularx-qrcode';

import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { ChargeStatus, InscriptionOrder } from '../ordinalsbot';
import { getSubmittingState } from '../store/submittable/submittable-state';
import { MintFacade } from '../store/mint.facade';
import { LetModule } from '@rx-angular/template/let';
import { RouterLink } from '@angular/router';


@Component({
  selector: 'app-order-details',
  templateUrl: './order-details.component.html',
  styleUrls: ['./order-details.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    PushModule,
    JsonPipe,
    NgClass,
    LoadingIndicatorComponent,
    NgIf,
    QRCodeModule,
    LetModule,
    RouterLink
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailsComponent {

  mintFacade = inject(MintFacade);

  ChargeStatus = ChargeStatus;
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
