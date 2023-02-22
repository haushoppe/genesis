import { Injectable } from '@angular/core';
import Onboard from '@web3-onboard/core';
import injectedModule from '@web3-onboard/injected-wallets';
import { ethers } from 'ethers';
import { retry } from 'rxjs';

import { knownAbis } from '../../../../shared/known-abis';
import { environment } from '../../environments/environment';
import { ApiService, StatusResponse } from '../openapi-client';

const injected = injectedModule()

declare global {
  interface Window {
    ethereum: ethers.providers.ExternalProvider;
  }
}

const abi = knownAbis[environment.tokenName];




@Injectable({
  providedIn: 'root'
})
export class MintService {

  status?: StatusResponse;

  provider?: ethers.providers.Web3Provider;
  signer?: ethers.providers.JsonRpcSigner;
  contract?: ethers.Contract;

  loggedIn = false;
  walletAddress = "";

  constructor(apiService: ApiService) {

    apiService.status(environment.tokenName).pipe(
      retry({
        count: 3,
        delay: 1000
      })
    ).subscribe(status => this.status = status);
  }

  checkForWeb3Provider() {
    return !!window.ethereum;
  }


  async connectWallet() {

    this.onboardConnectWallet();

    if (!this.provider) { console.error('No provider!'); return; }
  }

  async onboardConnectWallet () {

    if (!this.status) {
      return;
    }

    const onboard = Onboard({
      wallets: [injected],
      chains: [this.status.knownTokens[0].networkConfig as any]
    });

    const wallets = await onboard.connectWallet()
    if (wallets[0]) {

      // create an ethers provider with the last connected wallet provider
      this.provider = new ethers.providers.Web3Provider(wallets[0].provider, 'any')

      this.signer = this.provider.getSigner();

      // initialize the contract object with a signer to be able to do transactions
      this.contract = new ethers.Contract(this.status.knownTokens[0].address, abi, this.signer);
      console.log("Token contract address is " + this.contract.address);
    }
  }


  /**
   * Pop up wallet dialog to get user to sign a message.
   * Check that signature is valid and really was signed by the "signer" account.
   */
  async signMessage() {

    if (!this.provider) { console.error('No provider!'); return; }
    if (!this.signer) { console.error('No signer!'); return; }
    if (!this.contract) { console.error('No Contract!'); return; }

    this.walletAddress = await this.signer.getAddress();
    const ens_name = await this.provider.lookupAddress(this.walletAddress);
    if (ens_name) {
      this.walletAddress = ens_name;
    }

    const message = "Sign this message to prove ownership of account " + this.walletAddress + "\n\nNo transaction is submitted.";

    try {
      // Pop up wallet notification to sign
      const signature = await this.signer.signMessage(message);

      // Verify that signature matches wallet address
      this.loggedIn = ethers.utils.verifyMessage(message, signature) == this.walletAddress;

    } catch (error) {
      console.error(error);
    }
  }

}
