const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


describe("ILendable contract", () => {
  
  const tokenName = 'ArtistToken';
  let token;
  let owner, addr1, addr2, addr3;

  // Make sure contract is compiled and artifacts are generated!
  beforeEach(async () => {

    const [_owner, _addr1, _addr2, _addr3] = await ethers.getSigners();
    owner = _owner;
    addr1 = _addr1;
    addr2 = _addr2;
    addr3 = _addr3;
    
    const instance = await ethers.getContractFactory(tokenName);
    token = await instance.deploy();
    await token.deployed();
    // console.log('Token deployed! ⭐️ Contract address: ' + token.address);
  });

  xdescribe("after deployment", () => {

    it('should have sale and lending disabled', async () => {
      expect(await token.isSaleActive()).to.equal(false);
      expect(await token.isLendingActive()).to.equal(false);
    });

    it('should have 0 supply', async () => {
      expect(await token.totalSupply()).to.equal(0);
      expect(await token.totalLoaned()).to.equal(0);
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

    it('should be able to mint tokens', async () => {
      await token.mint(3);

      expect(await token.balanceOf(owner.address)).to.equal(3);
      expect(await token.totalSupply()).to.equal(3);
      expect(await token.totalMintsPerAddress(owner.address)).to.equal(3); // not part of ILendable
    });

    it('owner should be able to gift tokens to multiple addresses', async () => {
      await token.gift([addr1.address, addr2.address], 5);
      
      expect(await token.balanceOf(addr1.address)).to.equal(5);
      expect(await token.balanceOf(addr2.address)).to.equal(5);
      expect(await token.balanceOf(addr3.address)).to.equal(0); // addr3 got nothing!
      expect(await token.totalSupply()).to.equal(10);
      expect(await token.totalMintsPerAddress(addr1.address)).to.equal(5); // not part of ILendable
      expect(await token.totalMintsPerAddress(addr2.address)).to.equal(5); // not part of ILendable
    });

    it('should be able to mint, lend and retrieve a token', async () => {
      
      await token.mint(3);

      await token.loan(0, addr1.address);
      await token.loan(1, addr1.address);
      await token.loan(2, addr2.address);

      expect(await token.totalLoaned()).to.equal(3);

      expect(await token.balanceOf(owner.address)).to.equal(0);
      expect(await token.balanceOf(addr1.address)).to.equal(2);
      expect(await token.balanceOf(addr2.address)).to.equal(1);

      expect(await token.tokenOwnersOnLoan(0)).to.equal(owner.address);
      expect(await token.tokenOwnersOnLoan(1)).to.equal(owner.address);
      expect(await token.tokenOwnersOnLoan(2)).to.equal(owner.address);

      // The transaction has been reverted to the initial state.
      // Error provided by the contract:
      // TransferCallerNotOwnerNorApproved : The caller must own the token or be an approved operator.
      await token.retrieveLoan(1);
      // await token.retrieveLoan(2);

      // expect(await token.totalLoaned()).to.equal(1);

      // expect(await token.balanceOf(owner.address)).to.equal(2);
      // expect(await token.balanceOf(addr1.address)).to.equal(1);
      // expect(await token.balanceOf(addr2.address)).to.equal(0);
    });

  });

});