 // see https://www.chaijs.com/api/bdd/ for the API Reference
const { expect } = require("chai");

describe("ILendable contract", () => {
  
  let token;
  const tokenName = 'ArtistToken';

  // Make sure contract is compiled and artifacts are generated!
  beforeEach(async () => {

    const metadata = JSON.parse(await remix.call('fileManager', 'getFile', `artifacts/${tokenName}.json`))
    const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner()
    const instance = new ethers.ContractFactory(metadata.abi, metadata.data.bytecode.object, signer);
    token = await instance.deploy();
    
    await token.deployed();
    // console.log('Token deployed! ⭐️ Contract address: ' + token.address);
  });

  describe("after deployment", () => {

    it('should have sale and lending disabled', async () => {
      expect(await token.isSaleActive()).to.equal(false);
      expect(await token.isLendingActive()).to.equal(false);
    });

  });

  describe("after setup", () => {

    beforeEach(async () => {
      await token.setSaleStatus(true)
      await token.setLendingStatus(true);
    });

    it('should have sale and lending active', async () => {
      expect(await token.isSaleActive()).to.equal(true);
      expect(await token.isLendingActive()).to.equal(true);
    });


  });

});