/**
 * Creates an array with incrementing numbers.
 *
 * @param {number} n - The amount of numbers to include in the array.
 * @returns {number[]} An array of incrementing numbers from 0 to n - 1.
 */
export const createFilledArray = (n: number): number[] => [...Array(n).keys()];
