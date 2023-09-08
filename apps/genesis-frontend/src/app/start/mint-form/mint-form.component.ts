import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NumericTextBoxModule as KendoNumericTextBoxModule } from '@progress/kendo-angular-inputs';
import { LabelModule as KendoLabelModule } from '@progress/kendo-angular-label';
import { LetModule } from '@rx-angular/template/let';
import { ethers } from 'ethers';

import { LoadingIndicatorButtonComponent } from '../../layout/loading-indicator-button/loading-indicator-button.component';
import { multiplyWeiPrice } from '../../services/ethers-utils';
import { MintFacade } from '../../store/mint.facade';
import { SubmitStatus } from '../../store/submittable/submit-status';
import { WalletFacade } from '../../store/wallet.facade';

@Component({
  selector: 'app-mint-form',
  templateUrl: './mint-form.component.html',
  styleUrls: ['./mint-form.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    LoadingIndicatorButtonComponent,
    KendoNumericTextBoxModule,
    KendoLabelModule,
    ReactiveFormsModule,
    LetModule,
    NgClass
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MintFormComponent {

  mintFacade = inject(MintFacade);
  walletFacade = inject(WalletFacade);
  SubmitStatus = SubmitStatus;

  form = new FormGroup({
    amount: new FormControl(1, {
      nonNullable: true,
      validators: [
        Validators.required
      ]
    })
  });

  c = this.form.controls;

  mintAllowlist() {
    const amount = this.c.amount.value;
    if (amount) {
      this.mintFacade.mintAllowlist(amount);
    }
  }

  get puralisedMintText() {
    const amount = this.c.amount.value;

    if (this.form.invalid) {
      return 'Please enter a valid amount!'
    }

    switch (amount) {
      case 1: return 'Mint a new element';
      case 2: return 'Mint two new elements';
      case 3: return 'Mint three new elements';
      case 4: return 'Mint four new elements';
      default: return `Mint ${ amount } new elements`
    }
  }

  /**
   * Multiplies a price given in wei with a multiplier.
   *
   * @param {string} priceWeiString The price in wei as a string.
   * @param {number} multiplier The multiplier.
   * @returns {string} The result of the multiplication as a string.
   */
  multiply(priceInWei: string | undefined, multiplier: number | null): string {

    if (!priceInWei) {
      return '0';
    }

    if (!multiplier) {
      multiplier = 1;
    }

    const newPriceInWei = multiplyWeiPrice(priceInWei, multiplier)
    return ethers.formatEther(newPriceInWei);
  }
}
