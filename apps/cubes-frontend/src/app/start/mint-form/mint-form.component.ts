import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LetModule } from '@rx-angular/template/let';

import { LoadingIndicatorButtonComponent } from '../../layout/loading-indicator-button/loading-indicator-button.component';
import { MintFacade } from '../../store/mint.facade';
import { SubmitStatus } from '../../store/submittable/submit-status';
import { WalletFacade } from '../../store/wallet.facade';
import { InscriptionIdValidator } from './inscription-id.validator';
import { TrimValueAccessorDirective } from './trim-value-accessor.directive';

@Component({
  selector: 'app-mint-form',
  templateUrl: './mint-form.component.html',
  styleUrls: ['./mint-form.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    LoadingIndicatorButtonComponent,
    ReactiveFormsModule,
    LetModule,
    NgClass,
    TrimValueAccessorDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MintFormComponent {

  mintFacade = inject(MintFacade);
  walletFacade = inject(WalletFacade);
  SubmitStatus = SubmitStatus;

  form = new FormGroup({
    inscriptionId1: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId2: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId3: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId4: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId5: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId6: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    receiveAddress: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  }
  );

  c = this.form.controls;

  mint() {
    const inscriptionIds = [
      this.c.inscriptionId1.value.toLowerCase(),
      this.c.inscriptionId2.value.toLowerCase(),
      this.c.inscriptionId3.value.toLowerCase(),
      this.c.inscriptionId4.value.toLowerCase(),
      this.c.inscriptionId5.value.toLowerCase(),
      this.c.inscriptionId6.value.toLowerCase(),
    ];
    const receiveAddress = this.c.receiveAddress.value.toLowerCase();

    console.log('Minting: ')

    this.mintFacade.mint(inscriptionIds, receiveAddress);

  }
}

