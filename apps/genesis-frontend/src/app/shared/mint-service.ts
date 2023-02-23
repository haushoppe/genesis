import { Injectable } from '@angular/core';
import { ethers } from 'ethers';

import { WalletService } from './wallet-service';

declare global {
  interface Window {
    ethereum: ethers.providers.ExternalProvider;
  }
}



@Injectable({
  providedIn: 'root'
})
export class MintService {

  loggedIn = false;

  constructor(private walletService: WalletService) { }

  checkForWeb3Provider() {
    return !!window.ethereum;
  }

  async connectWallet() {

    this.walletService.connect();
  }


  /**
   * Pop up wallet dialog to get user to sign a message.
   * Check that signature is valid and really was signed by the "signer" account.
   */
  async signMessage() {

    if (!this.walletService.provider) { console.error('No provider!'); return; }
    if (!this.walletService.signer) { console.error('No signer!'); return; }
    if (!this.walletService.contract) { console.error('No Contract!'); return; }

    let walletAddress = await this.walletService.signer.getAddress();
    const ens_name = await this.walletService.provider.lookupAddress(walletAddress);
    if (ens_name) {
      walletAddress = ens_name;
    }

    const message = "Sign this message to prove ownership of account " + walletAddress + "\n\nNo transaction is submitted.";

    try {

      // Pop up wallet notification to sign
      const signature = await this.walletService.signer.signMessage(message);

      // Verify that signature matches wallet address
      this.loggedIn = ethers.utils.verifyMessage(message, signature) == walletAddress;

    } catch (error) {
      console.error(error);
    }
  }



}
