const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("./_utils");

[/*'GenesisToken',*/ 'MosaicToken'].forEach(tokenName => {

  describe(`IMosaic ${tokenName}`, () => {

    let owner, token;

    beforeEach(async () => {
      const [_owner] = await ethers.getSigners();
      owner = _owner;
      token = await deployToken(tokenName, owner);

      await token.setSaleStatus(true);
      await token.setBatchMosaicMintStatus(true);
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

    // TODO -- find an efficient algorithm to check for duplicate params
    it('should not be possible to use a tile twice in a mosaic', async () => {

      await token.mint(4);

      // this must revoke
      await token.mintMosaic(1, 1, 1, 1);

      // tokenURI for the mosaic -- this should not be possible
      expect(await token.tokenURI(4)).to.equal('https://example-mosaic.org/4/1/1/1/1');

    });

    it('should be able to mint mosaics in a batch', async () => {

      // owner mints 12 tokens for 3 mosaics
      await token.mint(12);

      // mint a 3 mosaics - new tokenIds are #12, #13, #14
      await token.mintMosaicBatch(
        [ 0, 1, 2, 3 ],
        [ 4, 5, 6, 7 ],
        [ 8, 9, 10, 11 ],
        [ 0, 0, 0, 0 ] // skipped
      );

      expect(await token.totalSupply()).to.equal(15, 'There must be 15 tokens now!');

      expect(await token.isMosaic(12)).to.equal(true, 'Token #12 is not a Mosaic');
      expect(await token.isMosaic(13)).to.equal(true, 'Token #13 is not a Mosaic');
      expect(await token.isMosaic(14)).to.equal(true, 'Token #14 is not a Mosaic');

      // check all tokenURIs for the mosaics
      expect(await token.tokenURI(12)).to.equal('https://example-mosaic.org/12/0/1/2/3');
      expect(await token.tokenURI(13)).to.equal('https://example-mosaic.org/13/4/5/6/7');
      expect(await token.tokenURI(14)).to.equal('https://example-mosaic.org/14/8/9/10/11');
    });
    
  });
});