const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("./_utils");

['GenesisToken', 'MosaicToken'].forEach(tokenName => {

  describe(`IMosaic ${tokenName}`, () => {

    let owner, token;

    beforeEach(async () => {
      const [_owner] = await ethers.getSigners();
      owner = _owner;
      token = await deployToken(tokenName, owner);

      await token.setSaleStatus(true);
      await token.setBaseURI('https://example.org/');
      await token.setBaseURIForMosaic('https://example-mosaic.org/');
    });

    it('should be able to create 2 mosaics', async () => {

      // owner mints 10 tokens - first token is #1
      await token.mint(10);

      expect(await token.ownerOf(0)).to.equal(owner.address);
      expect(await token.ownerOf(1)).to.equal(owner.address);
      expect(await token.ownerOf(2)).to.equal(owner.address);
      expect(await token.ownerOf(3)).to.equal(owner.address);
      expect(await token.ownerOf(4)).to.equal(owner.address);
      expect(await token.ownerOf(5)).to.equal(owner.address);
      expect(await token.ownerOf(6)).to.equal(owner.address);
      expect(await token.ownerOf(7)).to.equal(owner.address);
      expect(await token.ownerOf(8)).to.equal(owner.address);
      expect(await token.ownerOf(9)).to.equal(owner.address);

      // -- ROUND 1

      // mint a mosaic - tokenId is now #10
      await token.mintMosaic(1, 2, 5, 6);

      expect(await token.ownerOf(10)).to.equal(owner.address);
      expect(await token.isMosaic(10)).to.equal(true);
      expect((await token.mosaics(10)).map(x => x.toString())).to.eql(["1", "2", "5", "6"] )

      // the other tokens are not a mosaic
      expect(await token.isMosaic(1)).to.equal(false);

      // tokenURI for normal token
      expect(await token.tokenURI(1)).to.equal('https://example.org/1');

      // tokenURI for the mosaic
      expect(await token.tokenURI(10)).to.equal('https://example-mosaic.org/10/1/2/5/6');

      // -- ROUND 2

      // mint another mosaic, by using normal tokens and the new mosaic  - tokenId is now #11
      await token.mintMosaic(3, 4, 7, 10);

      expect(await token.ownerOf(11)).to.equal(owner.address);
      expect(await token.isMosaic(11)).to.equal(true);
      expect((await token.mosaics(11)).map(x => x.toString())).to.eql(["3", "4", "7", "10"] )
      expect(await token.tokenURI(11)).to.equal('https://example-mosaic.org/11/3/4/7/10');
    });
  });
});