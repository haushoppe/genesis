/**
 * Pseudorandom number generator
 * TS version of the ArtBlocks generator
 *
 * see https://docs.artblocks.io/creator-docs/creator-onboarding/readme/
 */
export class PseudoRandom {

  private useA = false;
  private prngA: () => number;
  private prngB: () => number;

  constructor(transactionHash: string) {

    // seed prngA with first half of hash
    this.prngA = this.sfc32(transactionHash.substr(2, 32));

    // seed prngB with second half of hash
    this.prngB = this.sfc32(transactionHash.substr(34, 32));
    for (let i = 0; i < 1e6; i += 2) {
      this.prngA();
      this.prngB();
    }
  }

  private sfc32(uint128Hex: string) {
    let a = parseInt(uint128Hex.substr(0, 8), 16);
    let b = parseInt(uint128Hex.substr(8, 8), 16);
    let c = parseInt(uint128Hex.substr(16, 8), 16);
    let d = parseInt(uint128Hex.substr(24, 8), 16);
    return function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  };

  /**
   * random number between 0 (inclusive) and 1 (exclusive)
   *
   * @example random number between 0 (inclusive) and 1 (exclusive)
   */
  randomDec() {
    this.useA = !this.useA;
    return this.useA ? this.prngA() : this.prngB();
  }

  /**
   * random number between a (inclusive) and b (exclusive)
   *
   * @example R.randomNum(0, 10) // Random decimal [0-10)
   */
  randomNum(a: number, b: number) {
    return a + (b - a) * this.randomDec();
  }

  /**
   * random integer between a (inclusive) and b (inclusive)
   * requires a < b for proper probability distribution
   *
   * @example R.randomInt(0, 10) // Random integer [0-10]
   */
  randomInt(a: number, b: number) {
    return Math.floor(this.randomNum(a, b + 1));
  }

  /**
   * random boolean with p as percent liklihood of true
   * @example R.randomBool(0.5)  // Random boolean with probability 0.5
   */
  randomBool(p: number) {
    return this.randomDec() < p;
  }

  /**
   * random value in an array of items
   * @example R.randomChoice([1, 2, 3])  // Random choice from a given list.
   */
  randomChoice(list: number[]) {
    return list[this.randomInt(0, list.length - 1)];
  }
}
