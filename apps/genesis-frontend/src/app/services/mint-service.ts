import { Injectable } from '@angular/core';
import { ethers } from 'ethers';

import { knownAbis } from '../../../../shared/known-abis';
import { environment } from '../../environments/environment';
import { MintTicket } from '../openapi-client';

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
  async signMessage(provider: ethers.BrowserProvider | undefined): Promise<boolean> {

    if (!provider) {
      return false;
    }

    const signer = await provider.getSigner();
    const walletAddress = await signer.getAddress();

    const message = "Sign this message to prove ownership of account " + walletAddress + "\n\nNo transaction is submitted.";

    try {

      // pop up wallet notification to sign
      const signature = await signer.signMessage(message);
      console.log(signature)

      // verify that signature matches wallet address
      const validMessage = ethers.verifyMessage(message, signature) == walletAddress;
      return validMessage;

    } catch (error) {
      console.error(error);
    }

    return false;
  }

  async totalSupply(provider: ethers.BrowserProvider | undefined, contractAddress: string | undefined): Promise<number> {

    if (!provider || !contractAddress) {
      throw Error('Web3Provider or contractAddress is missing!')
    }

    const contract = await this.initContract(provider, contractAddress);
    const totalSupply = (await contract.totalSupply());
    return totalSupply;
  }

  /**
   * Allow for minting of tokens up to the maximum allowed for a given address.
   * Minting also means you agree to our terms and conditions. Please review them at `termsAndConditions`!
   * The address of the sender and the number of mints allowed are hashed and signed
   * with the server's private key and verified here to prove allowlist status.
   */
  async mintAllowlist(
    provider: ethers.BrowserProvider | undefined,
    contractAddress: string | undefined,
    mintNumber: number,
    price: string,
    mintTicket: MintTicket | undefined): Promise<void> {

    if (!provider || !contractAddress || !mintTicket) {
      throw Error('Web3Provider or contractAddress or mintTicket is missing!')
    }

    const contract = await this.initContract(provider, contractAddress);
    await contract.mintAllowlist(
      mintTicket.messageHash,
      mintTicket.signature,
      mintNumber,
      mintTicket.maximumAllowedMints,
      { value: price }
    )
  }

  // initialize the contract object with a signer to be able to do transactions
  private async initContract(provider: ethers.BrowserProvider, contractAddress: string) {

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
      // console.log("Contract object initialized for address " + contractAddress);
      return contract;
  }
}
