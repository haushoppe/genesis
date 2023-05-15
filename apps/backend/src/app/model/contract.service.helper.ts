import { ethers, EventLog } from 'ethers';

import { MintInfo } from '../types/mint-info';
import { TokenOwner } from '../types/token-owner';
import { ZERO_ADDRESS } from './ethers-utils';

/**
 * Creates an array with incrementing numbers.
 *
 * @param {number} n - The amount of numbers to include in the array.
 * @returns {number[]} An array of incrementing numbers from 0 to n - 1.
 */
export const createFilledArray = (n: number): number[] => [...Array(n).keys()];

/**
 * Extracts mint information for a given token ID from an Ethereum contract,
 * and if the contract implements the IMosaic functionality, it also retrieves the mosaic information.
 * @param {EventLog} event - The EventLog object containing minting information.
 * @param {boolean} implementsMosaics - A flag indicating whether the contract implements the IMosaic functionality.
 * @param {ethers.Contract} contract - The Ethereum contract instance.
 * @returns {Promise<MintInfo>} A Promise that resolves to a MintInfo object containing the minting information and, if applicable, the mosaic information.
*/
export async function extractMintInfo(
  event: EventLog,
  implementsMosaics: boolean,
  contract: ethers.Contract): Promise<MintInfo> {

  const [, to, tokenId_ ] = event.args;
  const tokenId = parseInt(tokenId_);

  const mintInfo: MintInfo = {
    mintedBy: to,
    tokenId,
    transactionHash: event.transactionHash,
    blockNumber: event.blockNumber
  }

  // proprietary extra: IMosaic
  if (implementsMosaics) {

    const isMosaic = await contract.isMosaic(mintInfo.tokenId)
    if (isMosaic) {
      mintInfo.isMosaic = true
      mintInfo.mosaics = (await contract.mosaics(mintInfo.tokenId)).map((x: string) => parseInt(x));
    }
  }

  return mintInfo;
}

/**
 * Extracts the token owner ADDRESS AND NAME and, if applicable, the lender information for a given token ID from an Ethereum contract.
 * If the contract implements lendable functionality, the lender information will be included in the returned TokenOwner object.
 *
 * @param {number} tokenId - The ID of the token for which to extract owner and lender information.
 * @param {boolean} implementsLendable - A flag indicating whether the contract implements lendable functionality.
 * @param {ethers.Contract} contract - The Ethereum contract instance.
 * @returns {Promise<TokenOwner>} A Promise that resolves to a TokenOwner object containing the token owner and lender information.
 */
export async function extractTokenOwner(
  tokenId: number,
  implementsLendable: boolean,
  lookupNameCallback: (address: string | null) => Promise<string>,
  contract: ethers.Contract): Promise<TokenOwner> {

  const owner$: Promise<string> = contract.ownerOf(tokenId);
  const lender$: Promise<string> = implementsLendable ? contract.tokenOwnersOnLoan(tokenId) : Promise.resolve(ZERO_ADDRESS);

  const [owner, lender] = await Promise.all([owner$, lender$]);

  const ownerName$ = lookupNameCallback(owner);
  const lenderName$ = (lender !== ZERO_ADDRESS) ? lookupNameCallback(lender) : Promise.resolve(null);

  const [ownerName, lenderName] = await Promise.all([ownerName$, lenderName$]);

  const tokenOwner: TokenOwner = {
    tokenId,
    owner,
    ownerName
  }

  if (lender !== ZERO_ADDRESS) {
    tokenOwner.lender = lender;
    tokenOwner.lenderName = lenderName;
  }

  return tokenOwner;
}

/**
 * Extracts the token owner NAME and, if applicable, the lender information for a given token ID from an Ethereum contract.
 * If the contract implements lendable functionality, the lender information will be included in the returned TokenOwner object.
 *
 * @param {number} tokenId - The ID of the token for which to extract owner and lender information.
 * @param {string} owner - The already known address of the new token owner
 * @param {boolean} implementsLendable - A flag indicating whether the contract implements lendable functionality.
 * @param {ethers.Contract} contract - The Ethereum contract instance.
 * @returns {Promise<TokenOwner>} A Promise that resolves to a TokenOwner object containing the token owner and lender information.
 */
export async function extractSimpleTokenOwner(
  tokenId: number,
  owner: string,
  implementsLendable: boolean,
  lookupNameCallback: (address: string | null) => Promise<string>,
  contract: ethers.Contract): Promise<TokenOwner> {

  const lender$: Promise<string> = implementsLendable ? contract.tokenOwnersOnLoan(tokenId) : Promise.resolve(ZERO_ADDRESS);
  const lender = await lender$;

  const ownerName$ = lookupNameCallback(owner);
  const lenderName$ = (lender !== ZERO_ADDRESS) ? lookupNameCallback(lender) : Promise.resolve(null);

  const [ownerName, lenderName] = await Promise.all([ownerName$, lenderName$]);

  const tokenOwner: TokenOwner = {
    tokenId,
    owner,
    ownerName
  }

  if (lender !== ZERO_ADDRESS) {
    tokenOwner.lender = lender;
    tokenOwner.lenderName = lenderName;
  }

  return tokenOwner;
}

/**
 * Converts token owner infos that are well-known after mint (no lending possible)
 *
 * @param {number} tokenId - The ID of the token.
 * @param {string} owner - The already known address of the new token owner
 * @returns {Promise<TokenOwner>} A Promise that resolves to a TokenOwner object containing the token owner information.
 */
export async function extractSimpleTokenOwnerAfterMint(
  tokenId: number,
  owner: string,
  lookupNameCallback: (address: string | null) => Promise<string>): Promise<TokenOwner> {

  const ownerName = await lookupNameCallback(owner);

  const tokenOwner: TokenOwner = {
    tokenId,
    owner,
    ownerName
  }

  return tokenOwner;
}
