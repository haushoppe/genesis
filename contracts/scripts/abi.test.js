const { expect } = require("chai");
const { ethers } = require("hardhat");

['ArtistToken', 'CubeToken'].forEach(tokenName => {

  describe(`${tokenName} contract`, () => {

    it('metadata should convert to full Human-Readable ABI', async () => {

      const metadata = JSON.parse(await remix.call('fileManager', 'getFile', `artifacts/${tokenName}.json`));
      const iface = new ethers.utils.Interface(metadata.abi);
      const readableAbi = iface.format(ethers.utils.FormatTypes.full);

      console.log(readableAbi);
      expect(readableAbi).to.have.lengthOf.greaterThan(0);
    });
  });
});
