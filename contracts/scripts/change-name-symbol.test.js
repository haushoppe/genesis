const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("./_utils");

[{
  tokenName: 'ArtistToken',
  name: 'Artist Token for Collectors Cube',
  symbol: 'ARTIST'
},
{
  tokenName: 'CubeToken',
  name: 'Collectors Cube',
  symbol: 'CUBE'
}].forEach(({ tokenName, name, symbol }) => {

  describe(`Change name & symbol: ${tokenName} contract`, () => {

    let owner, token;

    beforeEach(async () => {
      const [_owner] = await ethers.getSigners();
      owner = _owner;
      token = await deployToken(tokenName, owner);
    });

    it('should have the predefined name and symbol after deployment', async () => {
      expect(await token.name()).to.equal(name);
      expect(await token.symbol()).to.equal(symbol);
    });

    it('should change the name and symbol', async () => {

      await token.setName('New Name');
      await token.setSymbol('NEW_SYMBOL');

      expect(await token.name()).to.equal('New Name');
      expect(await token.symbol()).to.equal('NEW_SYMBOL');
    });
  });
});