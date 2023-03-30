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

  async totalSupply(provider: ethers.providers.Web3Provider | undefined, contractAddress: string | undefined): Promise<number> {

    if (!provider || !contractAddress) {
      throw Error('Web3Provider or contractAddress is missing')
    }

    const contract = this.initContract(provider, contractAddress);
    const totalSupply = (await contract.totalSupply()).toNumber();
    return totalSupply;
  }

  // initialize the contract object with a signer to be able to do transactions
  private initContract(provider: ethers.providers.Web3Provider, contractAddress: string) {

      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
      console.log("Contract object initialized for address " + contractAddress);
      return contract;
  }



}
