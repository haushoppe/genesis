import { inject, Injectable } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';
import { BitcoinNetworkType, createInscription, CreateInscriptionResponse } from 'sats-connect';

import { parseCube } from '../../../../shared/parse-cube';
import { REFERRALS } from '../../../../shared/referral-code';
import { OrdinalsService } from '../openapi-client';
import { InscriptionOrder } from '../ordinalsbot';
import { CubeDetails } from '../store/mint.actions';
import BitcoinEsploraApiProvider from './api/esplora/esploraAPiProvider';
import { HiroService } from './hiro.service';
import { isValidInscriptionId } from './is-valid-inscription-id';
import { removeTrailingPipes } from './mint-service-remove-trailing-pipes';


@Injectable({
  providedIn: 'root'
})
export class MintService {

  ordinalsService = inject(OrdinalsService);
  hiroService = inject(HiroService);

  readonly template1 = `<html><!--cubes.haushoppe.art--><body><script>t='`;
  readonly template1title = `<html><!--cubes.haushoppe.art--><head><title>__TITLE__</title></head><body><script>t='`;

  readonly template2 = `'</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>`;

  readonly dummyInscriptionIds = [
    // '09da2c75de72d006e2f24dac29a27976963a5723abe110cf2c29d1cf9225fb36i0',    // 1. #944 - orange - #ff9900
    // 'ce1e4fd0f31f802d2348ab27eeec9385f4e58e5f81606cd94200fcd05c622a37i0',    // 2. #945 - green  - #1c6b4c
    // 'dfcf3fc4aec42d2c0bdb3b6d26a4dac4ea7893b70f6b42ae9e5ac883621c6537i0',    // 3. #946 - red    - #f44336
    // '519bca4c2adec9c41f3de0099202d495ddf66c664fa801c14fc723a836938550i0',    // 4. #947 - blue   - #2196f3
    // 'f1ac3821de11c8fe7eabe39027915806662bc6e87a236e90f088cc3b371eaa80i0',    // 5. #949 - indigo - #3f51b5
    // 'f44905aeb2bdb5ac3e71999d6648b6425018656898c8c55fd7a3b7df7ab79ac2i0',    // 6. #950 - violet - #9c27b0
       '../assets/_______________________________________________side1.svg',
       '../assets/_______________________________________________side2.svg',
       '../assets/_______________________________________________side3.svg',
       '../assets/_______________________________________________side4.svg',
       '../assets/_______________________________________________side5.svg',
       '../assets/_______________________________________________side6.svg',
  ];

  getConcatenatedCubeData({
    inscriptionIds,
    rotationSpeedX,
    rotationSpeedY,
    colorPane,
    bgColor1,
    bgColor2
  }: CubeDetails) {

    const t =
      this.fallbackIfNotValidId(inscriptionIds.inscriptionId1, this.dummyInscriptionIds[0]) + '|'
    + this.fallbackIfNotValidId(inscriptionIds.inscriptionId2, this.dummyInscriptionIds[1]) + '|'
    + this.fallbackIfNotValidId(inscriptionIds.inscriptionId3, this.dummyInscriptionIds[2]) + '|'
    + this.fallbackIfNotValidId(inscriptionIds.inscriptionId4, this.dummyInscriptionIds[3]) + '|'
    + this.fallbackIfNotValidId(inscriptionIds.inscriptionId5, this.dummyInscriptionIds[4]) + '|'
    + this.fallbackIfNotValidId(inscriptionIds.inscriptionId6, this.dummyInscriptionIds[5]) + '|'
    + rotationSpeedX + '|'
    + rotationSpeedY + '|'
    + colorPane + '|'
    + bgColor1 + '|'
    + bgColor2;

    return removeTrailingPipes(t);
  }

  fallbackIfNotValidId(inscriptionId: string, fallback: string) {

    if (!inscriptionId || !isValidInscriptionId(inscriptionId)) {
      return fallback;
    }

    return inscriptionId;
  }

  getCubeHtml(cubeDetails: CubeDetails) {
    const t = this.getConcatenatedCubeData(cubeDetails);

    let template1: string;
    if (cubeDetails.title) {
      const title = cubeDetails.title
        .replace('<', '&lt;')
        .replace('>', '&gt;');
      template1 = this.template1title.replace('__TITLE__', title);
    } else {
      template1 = this.template1
    }

    const html = template1 + t + this.template2;

    if (!parseCube(html)) {
      return `<html style="color:red"><h1>Warning!</h1>You have entered data that would create an invalid cube. Please send us an email and a direct message (DM) so we can determine what went wrong.</head>`
    }

    return html;
  }

  async getFees() {

    const btcClient = new BitcoinEsploraApiProvider({
      network: 'Mainnet',
    });
    return await btcClient.getRecommendedFees();
  }

  placeOrder(
    cubeDetails: CubeDetails,
    receiveAddress: string,
    code: string,
    fee: number
  ): Observable<InscriptionOrder> {

    const inscriptionIds = cubeDetails.inscriptionIds;

    if (!inscriptionIds.inscriptionId1 ||
        !inscriptionIds.inscriptionId2 ||
        !inscriptionIds.inscriptionId3 ||
        !inscriptionIds.inscriptionId4 ||
        !inscriptionIds.inscriptionId5 ||
        !inscriptionIds.inscriptionId6) {
      throw 'InscriptionId is missing!'
    }

    const htmlString = this.getCubeHtml(cubeDetails);

    const order = this.ordinalsService.createHtmlInscriptionOrder({
      receiveAddress,
      htmlString,
      fee,
      code
    });

    return order as any;
  }

  createConnectInscription(cubeDetails: CubeDetails, fee: number): Observable<CreateInscriptionResponse> {

    if (!((window as any)?.BitcoinProvider?.createInscription)) {
      return throwError(() => new Error('Your Xverse wallet is outdated. Please update it!'))
    }

    const inscriptionIds = cubeDetails.inscriptionIds;

    if (!inscriptionIds.inscriptionId1 ||
        !inscriptionIds.inscriptionId2 ||
        !inscriptionIds.inscriptionId3 ||
        !inscriptionIds.inscriptionId4 ||
        !inscriptionIds.inscriptionId5 ||
        !inscriptionIds.inscriptionId6) {
      throw 'InscriptionId is missing!'
    }

    const contentType = 'text/markdown';
const content = `
# Ordinal Cubes

\`\`\`
    +-------+
   /|      /|
  +-+-----+ |
  | |     | |
  | +-----+-+
  |/      |/
  +-------+
\`\`\`

The world's smallest onchain gallery, visualized as a 3D cube. Permissionless. Immutable. Forever existing. Choose six inscriptions and claim them with your own cube!

**https://cubes.haushoppe.art/**`;
    const payloadType = 'PLAIN_TEXT';

    const appFeeAddress = REFERRALS[0].address; // the address where the inscription fee should go
    const appFee = REFERRALS[0].bonus; // the amount of sats that should be sent to the fee address
    const suggestedMinerFeeRate = fee; // suggest a fee rate for the transaction in sats/byte

    return new Observable<CreateInscriptionResponse>((observer) => {
      createInscription({
        payload: {
          network: {
            type: BitcoinNetworkType.Mainnet,
          },
          contentType,
          content,
          payloadType,
          suggestedMinerFeeRate,
        },
        onFinish: (response) => {
          observer.next(response);
          observer.complete();  // Complete the observable stream.
        },
        onCancel: () => {
          observer.error(new Error('You canceled the inscription.'));  // Emit an error.
        }
      });
    });
  }

  inscriptionNumberToId(inscriptionNumber: string) {
    return this.hiroService.getInscription(inscriptionNumber).pipe(
      map(x => x.id)
    );
  }
}
