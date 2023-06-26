import { DecimalPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';
import { debounceTime } from 'rxjs';

import { CubePreviewComponent } from '../../layout/cube-preview/cube-preview.component';
import { LoadingIndicatorButtonComponent } from '../../layout/loading-indicator-button/loading-indicator-button.component';
import { MintFacade } from '../../store/mint.facade';
import { SubmitStatus } from '../../store/submittable/submit-status';
import { WalletFacade } from '../../store/wallet.facade';
import { TrimValueAccessorDirective } from '../../trim-value-accessor.directive';
import { BtcAddressValidator } from './btc-address.validator';
import { CorrectCodeValidator } from './correct-code.validator';
import { InscriptionIdValidator } from './inscription-id.validator';
import { LoadingIndicatorComponent } from '../../layout/loading-indicator/loading-indicator.component';
import { TrimNumberValueAccessorDirective } from '../../trim-number-value-accessor.directive';

function containsOnlyNumbers(str: string) {
  const reg = /^\d+$/;
  return reg.test(str);
}

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
    TrimValueAccessorDirective,
    TrimNumberValueAccessorDirective,
    CubePreviewComponent,
    RouterLink,
    PushModule,
    LoadingIndicatorComponent,
    DecimalPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MintFormComponent implements OnInit {

  mintFacade = inject(MintFacade);
  walletFacade = inject(WalletFacade);
  cd = inject(ChangeDetectorRef);
  SubmitStatus = SubmitStatus;
  showCode = false;

  form = new FormGroup({
    inscriptionId1: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId2: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId3: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId4: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId5: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId6: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    receiveAddress: new FormControl('', { nonNullable: true, validators: [Validators.required, BtcAddressValidator()] }),
    code: new FormControl('', { nonNullable: true, validators: [CorrectCodeValidator()] })
  });

  c = this.form.controls;

  ngOnInit() {
    /*
    if (!environment.production) {
      this.form.patchValue({
        inscriptionId1: '6761724cd0a42d465efc3ea3ece3cb8790b47fd0f19799d0c257d6df80fcf642i0',
        inscriptionId2: 'ec6d1d7f5b8413355c63b23d8f5b8dde5f0e01dd89a38385b04918a24d8966d2i0',
        inscriptionId3: 'b43908f4c8458b7b3c797a6df42950ffcdd7008744aff0ca399e2b77fea4355ei0',
        inscriptionId4: '992f6822b6c3c34eb3297cd0d9923bd159c4d77efc0ce3dd1fe78a7be2898182i0',
        inscriptionId5: 'ee05f2605c99cf0059472674ceb499f90327f39b50c34b8725e772b70631ce32i0',
        inscriptionId6: '01911182a249543b3db1fd92b6f61c8f14487c2f3e780e19b83cd836a3d98f1fi0',
        receiveAddress: '???'
      })
    }*/

    this.c.inscriptionId1.valueChanges.pipe(debounceTime(1000)).subscribe(value => {
      if (value.includes('HAUS_HOPPE')) {
        this.showCode = true;
        this.form.patchValue({
          inscriptionId1: '',
          code: value
        });
        this.form.markAllAsTouched();
        this.cd.detectChanges();
      }
    });

    [
      this.c.inscriptionId1,
      this.c.inscriptionId2,
      this.c.inscriptionId3,
      this.c.inscriptionId4,
      this.c.inscriptionId5,
      this.c.inscriptionId6,
    ].forEach(c => c.valueChanges.pipe(debounceTime(1000)).subscribe(value => {

      if (!value) { return; }

      if (containsOnlyNumbers(value)) {

        this.mintFacade.lookupInscriptionId(value.trim()).subscribe(inscriptionId => {
          c.setValue(inscriptionId);
          this.cd.detectChanges();
        })
      }
    }));
  }

  getInscriptionIds() {
    return {
      inscriptionId1: this.c.inscriptionId1.value,
      inscriptionId2: this.c.inscriptionId2.value,
      inscriptionId3: this.c.inscriptionId3.value,
      inscriptionId4: this.c.inscriptionId4.value,
      inscriptionId5: this.c.inscriptionId5.value,
      inscriptionId6: this.c.inscriptionId6.value
    };
  }

  mint() {
    const inscriptionIds = this.getInscriptionIds()
    const receiveAddress = this.c.receiveAddress.value;
    const code = this.c.code.value
    this.mintFacade.mint(inscriptionIds, receiveAddress, code);
  }
}

