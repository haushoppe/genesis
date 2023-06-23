import { JsonPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input } from '@angular/core';
import { PushModule } from '@rx-angular/template/push';
import { QRCodeModule } from 'angularx-qrcode';

import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { ChargeStatus, OrderResponse } from '../ordinalsbot';
import { getSubmittingState } from '../store/submittable/submittable-state';


@Component({
  selector: 'app-order-display',
  templateUrl: './order-display.component.html',
  styleUrls: ['./order-display.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    PushModule,
    JsonPipe,
    NgClass,
    LoadingIndicatorComponent,
    NgIf,
    QRCodeModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDisplayComponent {

  ChargeStatus = ChargeStatus;
  submittingState = getSubmittingState();
  cd = inject(ChangeDetectorRef);

  @Input() order?: OrderResponse;

  showLightning = false;
  copyChainSuccessfull: boolean | undefined;
  copyAmountSuccessfull: boolean | undefined;
  copyPayreqSuccessfull: boolean | undefined;

  getFile() {
    if (this.order?.files && this.order?.files.length > 0) {
      return this.order.files[0];
    }
    return undefined;
  }

  getPaymentPending() {
    const file = this.getFile();
    if (file?.sent) {
      return false;
    }

    return true;
  }

  getLinkToChain() {
    if (!this.order) { return ''; };

    return 'bitcoin:' + this.order.charge.chain_invoice.address
      + '?amount=' + (this.order.charge.amount / 100000000)
      + '&label=cubes+order';
  }

  getLinkToLightning() {
    if (!this.order) { return ''; };

    return 'lightning:' + this.order.charge.lightning_invoice.payreq;
  }

  async copyChainAddressToClipboard() {
    if (!this.order) { return };

    try {
      await navigator.clipboard.writeText(this.order.charge.chain_invoice.address);
      this.copyChainSuccessfull = true;
    } catch {
      this.copyChainSuccessfull = false;
      console.error('Cant copy to clipboard!')
    }
    this.cd.detectChanges();
  }

  async copyAmountToClipboard() {
    if (!this.order) { return };

    try {
      await navigator.clipboard.writeText((this.order.charge.amount / 100000000) + '');
      this.copyAmountSuccessfull = true;
    } catch {
      this.copyAmountSuccessfull = false;
      console.error('Cant copy to clipboard!')
    }
    this.cd.detectChanges();
  }

  async copyPayreqToClipboard() {
    if (!this.order) { return };

    try {
      await navigator.clipboard.writeText(this.order.charge.lightning_invoice.payreq);
      this.copyPayreqSuccessfull = true;
    } catch {
      this.copyPayreqSuccessfull = false;
      console.error('Cant copy to clipboard!')
    }
    this.cd.detectChanges();
  }
}
