const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("./_utils");

['GenesisToken', 'MosaicToken'].forEach(tokenName => {

  describe(`IMosaic ${tokenName}`, () => {

    let owner, addr1, token;

    beforeEach(async () => {
      const [_owner, _addr1] = await ethers.getSigners();
      owner = _owner;
      addr1 = _addr1;
      token = await deployToken(tokenName, owner);

      await token.setSaleStatus(true);
      await token.setLendingStatus(true);
      await token.setBatchMosaicMintStatus(true);
      await token.setBaseURI('https://example.org/');
      await token.setBaseURIForMosaic('https://example-mosaic.org/');
    });

    it('should be able to create 2 mosaics', async () => {

      // user mints 10 tokens - first token is #1
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

    it('should NOT be possible to use a tile from another owner', async () => {
      await token.mint(4);

      // changes to owner
      await token.loan(1, addr1.address);
      await expect(token.mintMosaic(1, 2, 3, 4)).to.be.revertedWith('You must be the owner of all four tokens');
    });

    it('should NOT be possible to use a tile twice in a mosaic', async () => {
      await token.mint(4);

      // twice token #1 at different positions
      await expect(token.mintMosaic(1, 2, 3, 1)).to.be.revertedWith('All tokens for a mosaic must be unique');
      await expect(token.mintMosaic(1, 2, 1, 3)).to.be.revertedWith('All tokens for a mosaic must be unique');
      await expect(token.mintMosaic(2, 1, 3, 1)).to.be.revertedWith('All tokens for a mosaic must be unique');
      await expect(token.mintMosaic(2, 1, 1, 3)).to.be.revertedWith('All tokens for a mosaic must be unique');
    
      // this should be already covered, but just to be super sure
      await expect(token.mintMosaic(1, 1, 1, 3)).to.be.revertedWith('All tokens for a mosaic must be unique');
      await expect(token.mintMosaic(1, 1, 1, 1)).to.be.revertedWith('All tokens for a mosaic must be unique');

      // make sure that the tx was reverted and the supply and mosaics are not in a bogus state
      expect(await token.totalSupply()).to.equal(4, 'There must be still only 4 tokens now!');

      expect((await token.mosaics(0)).map(x => x.toString())).to.eql(["0", "0", "0", "0"]);
      expect((await token.mosaics(1)).map(x => x.toString())).to.eql(["0", "0", "0", "0"]);
      expect((await token.mosaics(2)).map(x => x.toString())).to.eql(["0", "0", "0", "0"]);
      expect((await token.mosaics(3)).map(x => x.toString())).to.eql(["0", "0", "0", "0"]);
      expect((await token.mosaics(4)).map(x => x.toString())).to.eql(["0", "0", "0", "0"]);
      expect((await token.mosaics(5)).map(x => x.toString())).to.eql(["0", "0", "0", "0"]);
      expect((await token.mosaics(6)).map(x => x.toString())).to.eql(["0", "0", "0", "0"]);
      expect((await token.mosaics(7)).map(x => x.toString())).to.eql(["0", "0", "0", "0"]);
    });

    it('should be able to mint 3 mosaics in a batch', async () => {

      // user mints 12 tokens for 3 mosaics
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

    it('should be able to mint 1, 2 and 4 mosaics in a batch, but not 0', async () => {

      // user mints 28 tokens
      await token.mint(28);

      
      await expect(token.mintMosaicBatch(
        [ 0, 0, 0, 0 ], // skipped
        [ 0, 0, 0, 0 ], // skipped
        [ 0, 0, 0, 0 ], // skipped
        [ 0, 0, 0, 0 ] // skipped
      )).to.be.revertedWith("First mosaic can't be skipped.");

      // mint a 1 mosaic - new tokenId is #28 --- this is not effective, but should be possible
      await token.mintMosaicBatch(
        [ 0, 1, 2, 3 ],
        [ 0, 0, 0, 0 ], // skipped
        [ 0, 0, 0, 0 ], // skipped
        [ 0, 0, 0, 0 ] // skipped
      );

      expect(await token.tokenURI(28)).to.equal('https://example-mosaic.org/28/0/1/2/3');

      // mint a 2 mosaics - new tokenIds are #29, #30
      await token.mintMosaicBatch(
        [ 4, 5, 6, 7 ],
        [ 8, 9, 10, 11],
        [ 0, 0, 0, 0 ], // skipped
        [ 0, 0, 0, 0 ] // skipped
      );

      expect(await token.tokenURI(29)).to.equal('https://example-mosaic.org/29/4/5/6/7');
      expect(await token.tokenURI(30)).to.equal('https://example-mosaic.org/30/8/9/10/11');


      // mint a 4 mosaics - new tokenIds are #31, #32, #33, #34
      await token.mintMosaicBatch(
        [ 12, 13, 14, 15 ],
        [ 16, 17, 18, 19 ],
        [ 20, 21, 22, 23 ],
        [ 24, 25, 26, 27 ]
      );

      expect(await token.tokenURI(31)).to.equal('https://example-mosaic.org/31/12/13/14/15');
      expect(await token.tokenURI(32)).to.equal('https://example-mosaic.org/32/16/17/18/19');
      expect(await token.tokenURI(33)).to.equal('https://example-mosaic.org/33/20/21/22/23');
      expect(await token.tokenURI(34)).to.equal('https://example-mosaic.org/34/24/25/26/27');


      expect(await token.totalSupply()).to.equal(35, 'There must be 35 tokens now!');
    });

    it('should NOT be possible to use a tile twice in a batch mint', async () => {

      // user mints 12 tokens for 3 mosaics
      await token.mint(12);

      // twice token #1
      await await expect(token.mintMosaicBatch(
        [ 0, 1, 2, 3 ],
        [ 4, 1, 6, 7 ],
        [ 8, 9, 10, 11 ],
        [ 0, 0, 0, 0 ]
      )).to.be.revertedWith('One of the tokens is already part of a mosaic');

      // nothing has happened
      expect(await token.totalSupply()).to.equal(12, 'There must be still 12 tokens!');
    });
  });
});