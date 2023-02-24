import { Injectable } from '@angular/core';
import Onboard, { OnboardAPI } from '@web3-onboard/core';

import injectedModule from '@web3-onboard/injected-wallets';
import ledgerModule from '@web3-onboard/ledger'
import trezorModule from '@web3-onboard/trezor'
import walletConnectModule from '@web3-onboard/walletconnect'
import coinbaseModule from '@web3-onboard/coinbase'


import { ethers } from 'ethers';
import { retry } from 'rxjs';

import { knownAbis } from '../../../../shared/known-abis';
import { environment } from '../../environments/environment';
import { ApiService, StatusResponse } from '../openapi-client';
import { hideBlocknativeLogo } from './hide-blocknative-logo';

const injected = injectedModule();
const ledger = ledgerModule();
const trezor = trezorModule({ email: 'team@haushoppe.art', appUrl: 'https://genesis.haushoppe.art' });
const walletConnect = walletConnectModule();
const coinbase = coinbaseModule();

const abi = knownAbis[environment.tokenName];

// see https://github.com/blocknative/web3-onboard/core/src/utils.ts
const ethereumIcon = `<svg height="100%" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4.99902 0.12619V5.20805L9.58065 7.12736L4.99902 0.12619Z" fill="white" fill-opacity="0.602"/>
  <path d="M4.99923 0.12619L0.416992 7.12736L4.99923 5.20805V0.12619Z" fill="white"/>
  <path d="M4.99902 10.4207V13.8737L9.58371 7.92728L4.99902 10.4207Z" fill="white" fill-opacity="0.602"/>
  <path d="M4.99923 13.8737V10.4201L0.416992 7.92728L4.99923 13.8737Z" fill="white"/>
  <path d="M4.99902 9.62134L9.58065 7.12739L4.99902 5.20923V9.62134Z" fill="white" fill-opacity="0.2"/>
  <path d="M0.416992 7.12739L4.99923 9.62134V5.20923L0.416992 7.12739Z" fill="white" fill-opacity="0.602"/>
</svg>`

const ethereumColor = '#627EEA';

const appMetadata = {
  name: 'Genesis',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38.9 32.2"><path d="M33.4 1.1c0 .1 0 .1-.1.2-.2.6-.5 1.2-.7 1.8-.1.3-.1.7-.1 1 0 .1-.1.2-.1.3l-.5.5c-.4.5-.7 1-1 1.6-.1.2-.2.5-.3.8-.1.2-.3.5-.5.7l-.6.3h-1c-.1 0-.2-.1-.3-.2-.1-.1-.1-.3-.1-.5 0-.5.1-.9.2-1.4 0-.2.1-.4.1-.6v-.7c-.1.1-.2.1-.3.2-.2.2-.4.4-.5.6-.2.4-.3.9-.3 1.3 0 .5.2.9.2 1.4v1c-.1.5-.2 1.1-.4 1.6-.2.3-.3.7-.5 1-.1.1-.2.3-.3.4-.2.3-.4.5-.6.8-.3.3-.6.7-.9 1-.2.3-.5.5-.7.8-.2.2-.4.4-.6.7.1.1.2.2.3.4 3.3 3.6 6.6 7.2 10 10.7.8.9 1.6 1.7 2.4 2.6.2.3.5.5.8.8.2.2.4.4.6.7h-7.8l-.4-.4c-.7-.8-1.5-1.6-2.2-2.4-2.1-2.2-4.1-4.5-6.2-6.7-.4-.5-.9-.9-1.3-1.4-.4.4-.7.7-1 1.1-2.4 2.6-4.8 5.1-7.2 7.7-.6.6-1.1 1.2-1.7 1.8l-.3.3c-.2.1-.5 0-.7 0H1.3c.1-.2.2-.3.4-.4C3.8 28.2 6 26 8.1 23.7c1.8-1.9 3.5-3.7 5.3-5.6.6-.6 1.1-1.2 1.7-1.8.2-.2.4-.4.5-.6-.1-.2-.3-.3-.4-.5-.2-.2-.3-.4-.5-.5-.4-.4-.7-.8-1.1-1.2-.4-.5-.8-1-1.1-1.6l-.3-.6c-.1-.3-.2-.6-.4-.9-.2-.7-.2-1.3-.2-2 0-.4.1-.7.1-1.1 0-.5 0-1-.2-1.4-.1-.3-.3-.5-.6-.7-.1-.1-.2-.2-.4-.3-.1.2-.1.4-.1.6 0 .3 0 .5.1.8.1.4.2.9.2 1.4 0 .1 0 .3-.1.4 0 .1-.2.1-.3.1-.3 0-.5.1-.8.1-.4 0-.9-.2-1.1-.6-.1-.2-.3-.3-.4-.6 0-.4-.1-.7-.2-.9-.2-.5-.4-.9-.7-1.3l-.7-.7c-.1-.1-.1-.2-.1-.3 0-.3 0-.6-.1-.9-.1-.4-.3-.8-.4-1.1-.1-.3-.3-.6-.4-.8.3 0 .5.1.8.2.4.1.7.2 1 .3.1 0 .2.1.4 0 .4-.1.7-.2 1.1-.3.2 0 .3-.1.5-.1h.7c.4 0 .7.1 1.1.2 0 .1.2.2.3.2.3.2.6.3.8.5s.4.5.6.7c.2.2.4.5.5.7.2.3.4.7.5 1 .3.5.5 1 .7 1.4.1.2.2.3.4.5.1.1.2.3.3.4.2.2.5.3.7.4.2.1.3.2.5.3-.1.2-.2.3-.4.5.2.2.4.5.6.7l2.4 2.7c.1.1.2.3.4.4l.2-.2c.3-.4.6-.7.9-1 .6-.7 1.2-1.4 1.8-2 .1-.2.3-.3.4-.5-.1-.2-.2-.3-.3-.5 0-.1.1-.1.1-.1l.9-.6c.3-.2.4-.4.6-.6.3-.3.4-.7.6-1.1.2-.5.5-1 .8-1.4l.3-.6c.1-.1.2-.3.3-.4.1-.2.3-.3.4-.5.1-.1.2-.2.4-.3.2-.2.5-.3.8-.5.2-.1.4-.1.6-.2s.4-.1.6-.1c.4 0 .7-.1 1.1 0 .3 0 .6.1.8.2.1 0 .3.1.4.1.1 0 .2.1.3 0 .2 0 .4-.1.7-.2s.5-.1.8-.2h.6z"/></svg>',
  // Optional wide format logo (ie icon and text) to be displayed in the sidebar of connect modal. Defaults to icon if not provided
  // Note: This will ONLY display on desktop. It is best used with wide format logos. Use `icon` for standard 40x40 icons.
  // logo?: string
  description: 'by HAUS HOPPE'
}

const i18n = {
  en: {
    accountCenter: {
      backToApp: 'Close'
    }
  }
}

const connect = {
  showSidebar: true,
  /**
   * Disabled close of the connect modal with background click and
   * hides the close button forcing an action from the connect modal
   */
  disableClose: false, // defaults to false
  /**If set to true, the last connected wallet will store in local storage.
   * Then on init, onboard will try to reconnect to that wallet with
   * no modals displayed
   */
  autoConnectLastWallet: false // defaults to false
}

const lightTheme = {
  '--w3o-background-color': '#ffffff',
  '--w3o-foreground-color': '#EFF1FC',
  '--w3o-text-color': '#1a1d26',
  '--w3o-border-color': 'lightgray',
  '--w3o-action-color': 'rgb(98, 98, 98)',
  // '--w3o-border-radius': '0px'
}



@Injectable({
  providedIn: 'root'
})
export class WalletService {

  backendStatus?: StatusResponse;

  onboard?: OnboardAPI;

  provider?: ethers.providers.Web3Provider;
  signer?: ethers.providers.JsonRpcSigner;
  contract?: ethers.Contract;

  constructor(apiService: ApiService) {

    apiService.status(environment.tokenName).pipe(
      retry({
        count: 3,
        delay: 1000
      })
    ).subscribe(backendStatus => {

      this.backendStatus = backendStatus;

      hideBlocknativeLogo();

      const chain = this.backendStatus.knownTokens[0].networkConfig as any;

      this.onboard = Onboard({
        wallets: [
          injected,
          ledger,
          trezor,
          walletConnect,
          coinbase
        ],
        chains: [{
          ...chain,
          icon: ethereumIcon,
          // color: ethereumColor
        }],
        appMetadata,
        i18n,
        connect,
        theme: lightTheme
      });
    });
  }

  checkForWeb3Provider() {
    return !!window.ethereum;
  }


  async connect() {

    if (!this.onboard) {
      return;
    }


    const wallets = await this.onboard.connectWallet();
    if (wallets[0]) {

      // create an ethers provider with the last connected wallet provider
      this.provider = new ethers.providers.Web3Provider(wallets[0].provider, 'any')

      this.signer = this.provider.getSigner();

      // initialize the contract object with a signer to be able to do transactions
      // this.contract = new ethers.Contract(this.status.knownTokens[0].address, abi, this.signer);
      // console.log("Token contract address is " + this.contract.address);
    }
  }
}







