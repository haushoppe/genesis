import { Injectable } from '@angular/core';

import { getLocalStore, setLocalStore } from './local-storage';
import { AddressPurposes, getAddress } from 'sats-connect';
import { WalletConnectResult, WalletInfo } from '../store/wallet.reducer';


interface XverseAddressResponse {
  addresses: {
    address: string,
    publicKey: string,
    purpose: AddressPurposes.ORDINALS | AddressPurposes.PAYMENT
  }[];
}




@Injectable({
  providedIn: 'root'
})
export class WalletService {

  async connect() {
    return this.connectXverseWallet();
  }

  async disconnect() {
    return undefined
  }

  getInstalledWallets() {

    const installedWallets = [];

    if (typeof (window as any).unisat !== 'undefined') {
      installedWallets.push({
        key: 'unisat',
        label: 'Unisat',
        logo: '/assets/btc-unisat-logo.png',
      });
    }

    if ((window as any)?.StacksProvider?.psbtRequest) {
      installedWallets.push({
        key: 'hiro',
        label: 'Hiro',
        logo: '/btc-hiro-logo.jpeg',
      });
    }

    if ((window as any)?.BitcoinProvider?.signTransaction?.toString()?.includes('Psbt')) {
      installedWallets.push({
        key: 'xverse',
        label: 'Xverse',
        logo: '/btc-xverse-logo.png',
      });
    }

    return installedWallets;
  }

  async connectXverseWallet(): Promise<WalletConnectResult> {

    let result: WalletConnectResult = {
      error: undefined,
      wallet: undefined
    };

    const getAddressOptions = {
      payload: {
        purposes: [AddressPurposes.ORDINALS],
        message: 'Please share your address for receiving Ordinals.',
        network: {
          type: 'Mainnet' as const,
        },
      },
      onFinish: (response: XverseAddressResponse) => {

        result = {
          error: undefined,
          wallet: {
            ordinalsAddress: response.addresses[0].address, // we only requested Ordinals, so it should be always the first one
          }
        }
      },
      onCancel: () => result = {
        error: new Error('Request was cancelled'),
        wallet: undefined
      }
    };

    try {
      await getAddress(getAddressOptions);
      return result;

    } catch (ex: unknown) {
      return {
        error: ex as Error,
        wallet: undefined
      };
    }
  };
}







