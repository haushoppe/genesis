import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AddressPurpose, BitcoinNetworkType, getAddress } from 'sats-connect';

import { WalletInfo } from '../store/wallet.reducer';


export interface XverseAddressResponse {
  addresses: {
    address: string,
    publicKey: string,
    purpose: AddressPurpose.Ordinals | AddressPurpose.Payment
  }[];
}

export const KnownOrdinalWallets = {
  unisat: {
    label: 'Unisat',
    logo: '/assets/btc-unisat-logo.png',
  },
  hiro: {
    label: 'Hiro',
    logo: '/assets/btc-hiro-logo.jpeg',
  },
  xverse: {
    label: 'Xverse',
    logo: '/assets/btc-xverse-logo.png',
  }
}


@Injectable({
  providedIn: 'root'
})
export class WalletService {

  connect() {
    return this.connectXverseWallet();
  }

  disconnect() {
    return of()
  }

  getInstalledWallets() {

    const installedWallets = [];

    if (this.getUnisatInstalled()) {
      installedWallets.push(KnownOrdinalWallets.unisat);
    }

    if (this.getHiroInstalled()) {
      installedWallets.push(KnownOrdinalWallets.hiro);
    }

    if (this.getXverseInstalled()) {
      installedWallets.push(KnownOrdinalWallets.xverse);
    }

    return installedWallets;
  }

  getUnisatInstalled(): boolean {
    return !!(typeof (window as any).unisat !== 'undefined')
  }

  getHiroInstalled(): boolean {
    return !!((window as any)?.StacksProvider?.psbtRequest);
  }

  getXverseInstalled(): boolean {
    return !!(((window as any)?.BitcoinProvider?.signTransaction?.toString()?.includes('Psbt')));
  }

  connectXverseWallet(): Observable<WalletInfo> {

    return new Observable<WalletInfo>((observer) => {
      getAddress({
        payload: {
          purposes: [AddressPurpose.Ordinals],
          message: 'Please share your address for receiving Ordinals.',
          network: {
            type: BitcoinNetworkType.Mainnet
          },
        },
        onFinish: (response: XverseAddressResponse) => {

          const ordinalsAddress = response.addresses.find(x => x.purpose === AddressPurpose.Ordinals);

          if (!ordinalsAddress) {
            observer.error(new Error('No Ordinals address found?!'));
          } else {
            observer.next({
              label: KnownOrdinalWallets.xverse.label,
              ordinalsAddress: ordinalsAddress.address,
              useConnectInscription: true
            });
            observer.complete();
          }
        },
        onCancel: () => {
          observer.error(new Error('Request was cancelled'));
        }
      });
    });
  };
}







