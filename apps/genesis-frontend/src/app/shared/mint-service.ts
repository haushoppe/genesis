import { Injectable } from "@angular/core";
import { ethers } from "ethers";
import { knownTokens } from '../../../../shared/known-tokens';
import { knownAbis } from '../../../../shared/known-abis';
import { KnownTokenConfig } from '../../../../shared/known-token-config';
import { environment } from "../../environments/environment";

declare global {
  interface Window {
    ethereum: ethers.providers.ExternalProvider;
  }
}

// to make it reusuable for later use :-)
const token = knownTokens.find(
  x => x.name === environment.tokenName &&
    x.network === environment.network) as KnownTokenConfig;

const abi = knownAbis[environment.tokenName];




@Injectable({
  providedIn: 'root'
})
export class MintService {

  provider?: ethers.providers.Web3Provider;
  signer?: ethers.providers.JsonRpcSigner;
  contract?: ethers.Contract;

  loggedIn = false;
  walletAddress = "";

  checkForWeb3Provider() {
    return !!window.ethereum;
  }

  connectToEthereum () {

    if (!this.checkForWeb3Provider()) {
      return false;
    }

    // A Web3Provider wraps a standard Web3 provider, which is
    // what MetaMask injects as window.ethereum into each page
    this.provider = new ethers.providers.Web3Provider(window.ethereum);

    // The MetaMask plugin also allows signing transactions to
    // send ether and pay to change state within the blockchain.
    // For this, you need the account signer...
    this.signer = this.provider.getSigner();

    // Initialize the contract object with a signer to be able to do transactions
    this.contract = new ethers.Contract(token.address, abi, this.signer);
    console.log("Contract address is " + this.contract.address);

    return true;
  }

  async connectWallet() {

    this.connectToEthereum();

    if (!this.provider) { console.error('No provider!'); return; }

    // Get wallet to ask for permission to connect to this site
    await this.provider.send("eth_requestAccounts", []);
    await this.login();
  }

  /**
   * Pop up wallet dialog to get user to sign a message.
   * Check that signature is valid and really was signed by the "signer" account.
   */
  async login() {

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
