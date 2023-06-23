import { animate, AUTO_STYLE, state, style, transition, trigger } from '@angular/animations';
import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ForModule } from '@rx-angular/template/for';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';

import { AlertComponent } from '../layout/alert/alert.component';
import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { LoadingIndicatorButtonComponent } from '../layout/loading-indicator-button/loading-indicator-button.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { MintFacade } from '../store/mint.facade';
import { SubmitStatus } from '../store/submittable/submit-status';
import { WalletFacade } from '../store/wallet.facade';
import { MintFormComponent } from './mint-form/mint-form.component';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrimValueAccessorDirective } from '../trim-value-accessor.directive';
import { UuidValidator } from '../uuid-validator';


const expandDuration = 500

@Component({
    selector: 'app-start',
    templateUrl: './start.component.html',
    styleUrls: ['./start.component.scss'],
    standalone: true,
    imports: [
      LoadingIndicatorComponent,
      LoadingIndicatorButtonComponent,
      AlertComponent,
      InscriptionListItemComponent,
      NgFor,
      NgIf,
      LetModule,
      ForModule,
      PushModule,
      MintFormComponent,
      RouterLink,
      TrimValueAccessorDirective,
      ReactiveFormsModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [
      trigger('collapse', [
        state('false', style({ height: AUTO_STYLE, visibility: AUTO_STYLE })),
        state('true', style({ height: '0', visibility: 'hidden' })),
        transition('false => true', animate(expandDuration + 'ms ease-in')),
        transition('true => false', animate(expandDuration + 'ms ease-out'))
      ])
    ]
})
export class StartComponent {
  mintFacade = inject(MintFacade);
  walletFacade = inject(WalletFacade);
  router = inject(Router);

  SubmitStatus = SubmitStatus;
  collapsed = true;

  form = new FormGroup({
    orderId: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        UuidValidator // does NOT work?????
      ]})
  });

  c = this.form.controls;

  navigateToOrder() {
    this.router.navigate(['/order', this.c.orderId.value]);
  }

}
