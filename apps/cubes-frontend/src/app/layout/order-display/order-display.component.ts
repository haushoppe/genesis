import { JsonPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { PushModule } from '@rx-angular/template/push';

import { ChargeStatus, OrderResponse } from '../../ordinalsbot';
import { getPaymentStatusMessage } from './get-payment-status-message';
import { getPaymentStatusBadge } from './get-payment-status-badge';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { SubmitStatus } from '../../store/submittable/submit-status';
import { getPaymentPending } from './get-payment-pending';
import { getSubmittingState } from '../../store/submittable/submittable-state';


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
    NgIf
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDisplayComponent {

  ChargeStatus = ChargeStatus;
  submittingState = getSubmittingState();

  constructor(private cd: ChangeDetectorRef) {}

  @Input() order?: OrderResponse;
  showLightning = false;
  copyChainSuccessfull: boolean | undefined;

  paymentStatusMessage() {
    return getPaymentStatusMessage(this.order?.charge.status)
  }

  getPaymentStatusBadge() {
    return getPaymentStatusBadge(this.order?.charge.status)
  }

  getPaymentPending() {
    return getPaymentPending(this.order?.charge.status)
  }


  copyChainAddressToClipboard() {

    if (this.order) {

      navigator.clipboard.writeText(this.order?.charge.chain_invoice.address).then(() => {
        console.log('AAAA')

        this.copyChainSuccessfull = true;
        this.cd.detectChanges();

      }).catch(() => {
        console.log('BBB')

        this.copyChainSuccessfull = false;
        this.cd.detectChanges();
      });
    }
  }


}
function inject(ChangeDetectorRef: any) {
  throw new Error('Function not implemented.');
}

