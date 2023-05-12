import { ethers } from "ethers";

/**
 * Multiplies a price given in wei with a multiplier.
 *
 * // Example usage:
 * let priceWeiString = "1000000000000000000"; // This represents 1 ETH in wei
 * let multiplier = 10;
 *
 * let resultString = multiplyWeiPrice(priceWeiString, multiplier);
 * console.log(resultString); // Should output '10000000000000000000'
 *
 * @param {string} priceWeiString The price in wei as a string.
 * @param {number} multiplier The multiplier.
 * @returns {string} The result of the multiplication as a string.
 */
export function multiplyWeiPrice(priceWeiString: string, multiplier: number): string {

  // Convert string and number to BigInt (ES2020)
  const priceWei = BigInt(priceWeiString);
  const multiplierBigInt = BigInt(multiplier);

  const result = priceWei * multiplierBigInt;

  // Convert the result back to a string
  return result.toString();
}
