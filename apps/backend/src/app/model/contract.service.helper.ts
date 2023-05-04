import { EventLog, ethers } from "ethers";
import { MintInfo } from "../types/mint-info";
import { TokenOwner } from "../types/token-owner";
import { ZERO_ADDRESS } from "./ethers-utils";

/**
 * Creates an array with incrementing numbers.
 *
 * @param {number} n - The amount of numbers to include in the array.
 * @returns {number[]} An array of incrementing numbers from 0 to n - 1.
 */
export const createFilledArray = (n: number): number[] => [...Array(n).keys()];


export async function extractMintInfo(
  event: EventLog,
  implementsMosaics: boolean,
  contract: ethers.Contract): Promise<MintInfo> {

  const mintInfo: MintInfo = {
    mintedBy: event.args[1],
    tokenId: parseInt(event.args[2]),
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
 * This function extracts the token owner and, if applicable, the lender information for a given token ID from an Ethereum contract.
 * If the contract implements lendable functionality, the lender information will be included in the returned TokenOwner object.
 *
 * @param tokenId - The ID of the token for which to extract owner and lender information.
 * @param implementsLendable - A flag indicating whether the contract implements lendable functionality. (ILendable)
 * @param contract - The Ethereum contract instance.
 * @returns A Promise that resolves to a TokenOwner object containing the token owner and lender information.
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
