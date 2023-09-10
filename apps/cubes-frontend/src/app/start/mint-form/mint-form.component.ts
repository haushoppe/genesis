import { DecimalPipe, JsonPipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { CubePreviewTitleComponent } from '../../layout/cube-preview/cube-preview-title.component';
import { CubePreviewComponent } from '../../layout/cube-preview/cube-preview.component';
import { LoadingIndicatorButtonComponent } from '../../layout/loading-indicator-button/loading-indicator-button.component';
import { LoadingIndicatorComponent } from '../../layout/loading-indicator/loading-indicator.component';
import { ShortenAddressPipe } from '../../layout/shorten-address.pipe';
import { CubeDetails } from '../../store/mint.actions';
import { MintFacade } from '../../store/mint.facade';
import { SubmitStatus } from '../../store/submittable/submit-status';
import { WalletFacade } from '../../store/wallet.facade';
import { TrimNumberValueAccessorDirective } from '../../trim-number-value-accessor.directive';
import { TrimValueAccessorDirective } from '../../trim-value-accessor.directive';
import { BtcAddressValidator } from './btc-address.validator';
import { CorrectCodeValidator } from './correct-code.validator';
import { InscriptionIdValidator } from './inscription-id.validator';

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
    CubePreviewTitleComponent,
    RouterLink,
    PushModule,
    LoadingIndicatorComponent,
    DecimalPipe,
    ShortenAddressPipe,
    JsonPipe,
    LoadingIndicatorComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MintFormComponent implements OnInit {

  @Input()
  useConnectInscription = false;

  @Input()
  public set walletAddress(address: string | undefined) {
    this.form.patchValue({ receiveAddress: address });
    if (address) {
      this.c.receiveAddress.disable();
      this.useConnectInscription = true;
    } else {
      this.c.receiveAddress.enable();
      this.useConnectInscription = false;
    }
  }

  mintFacade = inject(MintFacade);
  walletFacade = inject(WalletFacade);
  cd = inject(ChangeDetectorRef);
  SubmitStatus = SubmitStatus;
  showCode = false;
  showSecret = false;

  form = new FormGroup({
    inscriptionId1: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId2: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId3: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId4: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId5: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    inscriptionId6: new FormControl('', { nonNullable: true, validators: [Validators.required, InscriptionIdValidator()] }),
    title: new FormControl('', { nonNullable: true }),
    receiveAddress: new FormControl('', { nonNullable: true, validators: [Validators.required, BtcAddressValidator(), Validators.pattern('^bc1p.*')] }),
    // hiden code
    code: new FormControl('', { nonNullable: true, validators: [CorrectCodeValidator()] }),
    // hidden options of v3
    rotationSpeedX: new FormControl('', { nonNullable: true }),
    rotationSpeedY: new FormControl('', { nonNullable: true }),
    colorPane: new FormControl('', { nonNullable: true }),
    bgColor1: new FormControl('', { nonNullable: true }),
    bgColor2: new FormControl('', { nonNullable: true }),
  });

  c = this.form.controls;

  getBestAddressError() {
    const r = this.c.receiveAddress;

    if (r.hasError('required')) {
      return '';
    }

    if (r.hasError('pattern')) {
      return 'Please provide your Taproot address for receiving Ordinals, which always starts with "bc1p…"!';
    }

    if (r.hasError('invalidBtcAddress')) {
      return 'This is not a valid Bitcoin address!';
    }

    return '';
  }

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
      if (value.includes('HAUS_HOPPE') || value.includes('SECRET')) {

        if (value.includes('HAUS_HOPPE')) {
          this.showCode = true;
          this.form.patchValue({
            inscriptionId1: '',
            code: value
          });
        }

        if (value.includes('SECRET')) {
          this.showSecret = true;
          this.form.patchValue({
            inscriptionId1: ''
          });
        }

        this.form.markAllAsTouched();
        this.cd.detectChanges();
      }
    });

    this.form.valueChanges.pipe(
      map(v => ({
        size: this.mintFacade.getCubeHtml(MintFormComponent.mapCubeDetails(v)).length,
        code: v.code
      })),
      distinctUntilChanged((prev, curr) => {
        return JSON.stringify(prev) === JSON.stringify(curr);
      }),
      debounceTime(500)
    ).subscribe(({ size, code }) => {
      this.mintFacade.loadPrice(size, code);
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

  static mapCubeDetails(value: Partial<{
    inscriptionId1: string,
    inscriptionId2: string,
    inscriptionId3: string,
    inscriptionId4: string,
    inscriptionId5: string;
    inscriptionId6: string,
    title: string,
    receiveAddress: string,
    code: string,
    rotationSpeedX: string,
    rotationSpeedY: string,
    colorPane: string,
    bgColor1: string,
    bgColor2: string,
  }>): CubeDetails {

    return {
      inscriptionIds: {
        inscriptionId1: value.inscriptionId1 || '',
        inscriptionId2: value.inscriptionId2 || '',
        inscriptionId3: value.inscriptionId3 || '',
        inscriptionId4: value.inscriptionId4 || '',
        inscriptionId5: value.inscriptionId5 || '',
        inscriptionId6: value.inscriptionId6 || ''
      },
      title: value.title || '',
      rotationSpeedX: value.rotationSpeedX || '',
      rotationSpeedY: value.rotationSpeedY || '',
      colorPane: value.colorPane || '',
      bgColor1: value.bgColor1 || '',
      bgColor2: value.bgColor2 || ''
    };
  }

  getCubeDetails(): CubeDetails {
    return MintFormComponent.mapCubeDetails(this.form.value);
  }

  mint() {
    const cubeDetails = this.getCubeDetails();
    const receiveAddress = this.c.receiveAddress.value;
    const code = this.c.code.value;

    if (this.useConnectInscription) {
      this.mintFacade.createConnectInscription(cubeDetails);
    } else {
      this.mintFacade.placeOrder(cubeDetails, receiveAddress, code);
    }
  }
}

