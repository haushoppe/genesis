const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("./_utils");

const oneEther = ethers.utils.parseEther("1");
const twoEther = ethers.utils.parseEther("2");
const threeEther = ethers.utils.parseEther("3");
const aLittleBitGas = ethers.utils.parseEther("0.0001");

['ArtistToken', 'CubeToken'].forEach(tokenName => {

  describe(`Paypments: ${tokenName} contract`, () => {

    let owner, addr1, addr2, addr3, token;

    beforeEach(async () => {
      const [_owner, _addr1, _addr2, _addr3] = await ethers.getSigners();
      owner = _owner;
      addr1 = _addr1;
      addr2 = _addr2;
      addr3 = _addr3;
      token = await deployToken(tokenName, owner);

      await token.setSaleStatus(true)
      await token.setMintPrice(oneEther);
    });

    it('owner should be able to withdraw the contracts full balance to own address', async () => {

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      expect(await token.price()).to.equal(oneEther, 'Mint price must be 1 ETH');

      // addr1 goes to mint 3 token for 3 ETH
      await token.connect(addr1).mint(3, { value: threeEther });

      expect(await token.totalSupply()).to.equal(3);
     
      // owner withdraws everything
      await token.withdraw();
      
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      // console.log('BALANCE BEFORE: ' + format(ownerBalanceBefore));
      // console.log('BALANCE AFTER: ' + format(ownerBalanceAfter));
      // console.log('DIFFERENCE + GAS: ' + format(ownerBalanceAfter.sub(ownerBalanceBefore).add(aLittleBitGas)));

      // the owner has now 3 ETH more, but lost a bit money because of gas
      expect(ownerBalanceAfter.sub(ownerBalanceBefore).add(aLittleBitGas).gt(threeEther)).to.be.true;
    });

    it('owner should be able to withdraw some funds to another address', async () => {

      const otherBalanceBefore = await ethers.provider.getBalance(addr2.address);

      // addr1 goes to mint 3 token for 3 ETH
      await token.connect(addr1).mint(3, { value: threeEther });
     
      // owner withdraw 1 ETH to addr2
      await token.withdrawTo(addr2.address, oneEther);
      
      const otherBalanceAfter = await ethers.provider.getBalance(addr2.address);

      // has now exactly 1 ETH more
      expect(otherBalanceAfter.sub(otherBalanceBefore).eq(oneEther)).to.be.true;

      // contract still owns 2 ETH
      const contractBalanceAfter = await ethers.provider.getBalance(token.address);
      expect(contractBalanceAfter.eq(twoEther)).to.be.true;
    });

    it('should only possible by the contract owner to do a withdraw', async () => {

      // addr1 goes to mint 3 token for 3 ETH
      await token.connect(addr1).mint(3, { value: threeEther });
      
      await expect(token.connect(addr1).withdraw()).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(token.connect(addr1).withdrawTo(addr2.address, oneEther)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});