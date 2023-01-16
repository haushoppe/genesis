import { ethers } from "ethers";

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Creates a ethers.Wallet from a private key
 */
export function getSigner(privateKey: string) {

  const wallet = new ethers.Wallet(privateKey);
  // console.log('wallet address: ' +  wallet.address);
  // console.log('wallet mnemonic: ' + wallet.mnemonic.phrase);
  // console.log('wallet privateKey ' + wallet.privateKey);

  return wallet;
}

/**
 * pack an encoded message - same as abi.encodePacked in Solidity
 * shown here: https://blog.cabala.co/how-to-verify-off-chain-results-and-whitelist-with-ecdsa-in-solidity-using-openzeppelin-ethers-js-ba4c85521711
 * explained in detail here: https://89devs.com/solidity/keccak-hash/
 *
 * example MESSAGE: 0x5b38da6a701c568545dcfcb03fcb875f56beddc40000000000000000000000000000000000000000000000000000000000000004
 */
export function encodePackedMessage(sender: string, maximumAllowedMints: number): string {

  const message = ethers.utils.solidityPack(["address", "uint256"], [sender, maximumAllowedMints]);
  // console.log('MESSAGE encoded + packed: ' + message);
  return message;
}

/**
 * hash the message with keccak256
 * as shown here: https://blog.cabala.co/how-to-verify-off-chain-results-and-whitelist-with-ecdsa-in-solidity-using-openzeppelin-ethers-js-ba4c85521711
 *
 * Keccak256 is a hashing algorithm that can be used to convert an input into a fixed-size hash.
 * It can then be stored conveniently in the bytes 32 data type.
 */
export function hashMessage(message: string): string {

  const hash = ethers.utils.solidityKeccak256(["bytes"], [message]);
  // console.log('HASH: ' + hash);
  return hash;
}

/**
 * sign message with the signer wallet
 * this signature is the signature signed for the message with the signer's private key.
 */
export  async function signMessage(signer, message) {

  const signature = await signer.signMessage(ethers.utils.arrayify(message));
  // console.log('SIGNATURE: ' + signature);
  return signature;
}
