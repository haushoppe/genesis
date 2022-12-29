const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("./_utils");

describe(`Genesis contract`, () => {

  let tokenName = 'GenesisToken';
  let owner, token;

  beforeEach(async () => {
    const [_owner] = await ethers.getSigners();
    owner = _owner;
    token = await deployToken(tokenName, owner);

    await token.setSaleStatus(true);
    await token.setBaseURI('https://example.org/');
    await token.setBaseURIForMosaic('https://example-mosaic.org/', '?', ';');
  });

  it('should be able to create a mosaic', async () => {

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

    // mint a mosaic - tokenId is now #10
    await token.mintMosaic(1, 2, 5, 6);

    expect(await token.ownerOf(10)).to.equal(owner.address);

    expect(await token.tokenIsMosaic(10)).to.equal(true);
    expect(await token.tile1(10)).to.equal(1);
    expect(await token.tile2(10)).to.equal(2);
    expect(await token.tile3(10)).to.equal(5);
    expect(await token.tile4(10)).to.equal(6);

    // tokenURI for normal token
    expect(await token.tokenURI(1)).to.equal('https://example.org/1');

    // tokenURI for the mosaic
    expect(await token.tokenURI(10)).to.equal('https://example-mosaic.org/10?1;2;5;6');
  });
});
