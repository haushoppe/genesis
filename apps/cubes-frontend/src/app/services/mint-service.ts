import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { OrdinalsService } from '../openapi-client';
import { InscriptionOrder, OrderResponse } from '../ordinalsbot';
import { SixInscriptionIds } from '../store/mint.reducer';
import BitcoinEsploraApiProvider from './api/esplora/esploraAPiProvider';
import { HiroService } from './hiro-service';


@Injectable({
  providedIn: 'root'
})
export class MintService {

  ordinalsService = inject(OrdinalsService);
  hiroService = inject(HiroService);

  readonly template1 = `<html><!--cubes.haushoppe.art--><body><script>t='`;
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

  getCubeHtml(inscriptionIds: SixInscriptionIds | undefined) {

    inscriptionIds = inscriptionIds || {};

    return this.template1
      + (inscriptionIds.inscriptionId1 || this.dummyInscriptionIds[0]) + '|'
      + (inscriptionIds.inscriptionId2 || this.dummyInscriptionIds[1]) + '|'
      + (inscriptionIds.inscriptionId3 || this.dummyInscriptionIds[2]) + '|'
      + (inscriptionIds.inscriptionId4 || this.dummyInscriptionIds[3]) + '|'
      + (inscriptionIds.inscriptionId5 || this.dummyInscriptionIds[4]) + '|'
      + (inscriptionIds.inscriptionId6 || this.dummyInscriptionIds[5])
      + this.template2;
  }

  getCubeHtmlAsDataUrl(inscriptionIds: SixInscriptionIds) {

    const html = this.getCubeHtml(inscriptionIds);

    // Convert the HTML string to a base64 encoded string
    const encodedHtml = btoa(unescape(encodeURIComponent(html)));

    // Create a data URL
    const dataUrl = 'data:text/html;base64,' + encodedHtml;

    return dataUrl;
  }

  async getFees() {

    const btcClient = new BitcoinEsploraApiProvider({
      network: 'Mainnet',
    });
    return await btcClient.getRecommendedFees();
  }

  placeOrder(
    receiveAddress: string,
    inscriptionIds: SixInscriptionIds,
    fee: number,
    code: string): Observable<InscriptionOrder> {

    if (!inscriptionIds.inscriptionId1 ||
        !inscriptionIds.inscriptionId2 ||
        !inscriptionIds.inscriptionId3 ||
        !inscriptionIds.inscriptionId4 ||
        !inscriptionIds.inscriptionId5 ||
        !inscriptionIds.inscriptionId6) {
      throw 'InscriptionId is missing!'
    }

    const htmlString = this.getCubeHtml(inscriptionIds);

    const order = this.ordinalsService.createHtmlInscriptionOrder({
      receiveAddress,
      htmlString,
      fee,
      code
    });

    return order as any;
  }

  inscriptionNumberToId(inscriptionNumber: string) {
    return this.hiroService.getInscription(inscriptionNumber).pipe(
      map(x => x.id)
    );
  }
}
