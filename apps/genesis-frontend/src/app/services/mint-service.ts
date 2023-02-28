import { Injectable } from '@angular/core';
import { ethers } from 'ethers';

import { knownAbis } from '../../../../shared/known-abis';
import { environment } from '../../environments/environment';

const abi = knownAbis[environment.tokenName];


@Injectable({
  providedIn: 'root'
})
export class MintService {

  contract?: ethers.Contract;

  /**
   * Pop up wallet dialog to get user to sign a message.
   * Check that signature is valid and really was signed by the "signer" account.
   */
  async signMessage(provider: ethers.providers.Web3Provider | undefined): Promise<boolean> {

    if (!provider) {
      return false;
    }

    const signer = provider.getSigner();
    const walletAddress = await signer.getAddress();

    const message = "Sign this message to prove ownership of account " + walletAddress + "\n\nNo transaction is submitted.";

    try {

      // pop up wallet notification to sign
      const signature = await signer.signMessage(message);

      // verify that signature matches wallet address
      const validMessage = ethers.utils.verifyMessage(message, signature) == walletAddress;
      return validMessage;

    } catch (error) {
      console.error(error);
    }

    return false;
  }

  async todo() {
      // initialize the contract object with a signer to be able to do transactions
      // this.contract = new ethers.Contract(this.status.knownTokens[0].address, abi, this.signer);
      // console.log("Token contract address is " + this.contract.address);
  }



}
